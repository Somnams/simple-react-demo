const TEXT_ELEMENT = 'TEXT_ELEMENT';

/**
 * @param {string} key 
 * @returns boolean
 */
const isEvent = key => key.startsWith('on');
const isProperty = key => key !== 'children' && !isEvent(key);
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next);

/**
 * @param {string} type 
 * @param {Record<string, any>} props 
 * @param  {...any} children 
 * @typedef {{type: string|Function;
    props: {
        children: any[];
    }}} ReactElement
     @returns {ReactElement}
 */
function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(c =>
                typeof c === 'object' ? c : createTextElement(c)
            )
        }
    }
}

/**
 * @typedef {ReactElement & {
 * dom: HTMLDivElement,
 * alternate: FiberElement,
 * effectTag: "UPDATE"| "DELETION" |"PLACEMENT",
 * parent: FiberElement,
 * sibling:FiberElement, 
 * child: FiberElement }
 * } FiberElement
 * @param {FiberElement} fiber 
 */
function createDom(fiber) {
    const dom = fiber.type === TEXT_ELEMENT ? document.createTextNode("") : document.createElement(fiber.type);
    updateDom(dom, fiber.props, {});
    return dom;
}

function createTextElement(text) {
    return {
        type: TEXT_ELEMENT,
        props: {
            nodeValue: text,
            children: []
        }
    }
}

let nextUnitOfWork = null;
/** @type{FiberElement} */
let wipRoot = null;
/** @type{FiberElement} */
let currentRoot = null;
/** @type {Array<FiberElement> | null} */
let deletions = null;

/**
 * @param {ReactElement} element 
 * @param {HTMLDivElement} container
 */
function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        alternate: currentRoot,
    }
    deletions = [];
    nextUnitOfWork = wipRoot;
}

/**
 * @param {FiberElement['dom']} dom 
 * @param {FiberElement['props']} props 
 * @param {FiberElement['props']} oldFiber 
 */
function updateDom(dom, props, oldProps) {
    // * remove old event handler
    Object.keys(oldProps)
        .filter(isEvent)
        .filter(key => !(key in props) || isNew(oldProps, props)(key))
        .forEach(name => {
            const eventType = name.toLowerCase().slice(2);
            document.removeEventListener(eventType, oldProps[name]);
        })
    // * remove old properties
    Object.keys(oldProps)
        .filter(isProperty)
        .filter(isGone(oldProps, props))
        .forEach(p => dom[p] = '');
    // * set new or changed properties
    Object.keys(props)
        .filter(isProperty)
        .filter(isNew(oldProps, props))
        .forEach(p => { dom[p] = props[p] });
    // * add new event handler
    Object.keys(props)
        .filter(isEvent)
        .filter(isNew(oldProps, props))
        .forEach(name => {
            const eventType = name.toLowerCase().slice(2);
            document.addEventListener(eventType, props[name]);
        })
}

/**
 * @param {FiberElement} fiber 
 * @param {HTMLDivElement} domParent 
 */
function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom);
    } else {
        commitDeletion(fiber.child, domParent);
    }
}

/**
 * @param {FiberElement} fiber 
 */
function commitWork(fiber) {
    if (!fiber) return;
 
    let parentDomFiber = fiber.parent;
    // ? function component => dom: null
    while (!parentDomFiber.dom) {
        parentDomFiber = parentDomFiber.parent;
    }
    const parentDom = parentDomFiber.dom;

    if (fiber.effectTag === 'DELETION') {
        commitDeletion(fiber, parentDom);
    }
    if (fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
        parentDom.appendChild(fiber.dom);
    }
    if (fiber.effectTag === 'UPDATE' && fiber.dom !== null) {
        updateDom(fiber.dom, fiber.props, fiber.alternate.props);
    }

    commitWork(fiber.child);
    commitWork(fiber.sibling);
}

function commitRoot() {
    deletions.forEach(commitWork);
    commitWork(wipRoot.child);
    currentRoot = wipRoot;
    wipRoot = null;
}

/**
 * @param {IdleDeadline} deadline 
 */
function workLoop(deadline) {
    let shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        shouldYield = deadline.timeRemaining() < 1;
    }
    if (!nextUnitOfWork && wipRoot) {
        commitRoot();
    }
    requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

// * add the element t the DOM
// * create the fibers for the element's children
// * select the next unit of work

/**
 * @param {FiberElement} fiber 
 */
function updateHostComponent(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber);
    }
    const elements = fiber.props.children;
    reconcileChildren(fiber, elements);
}

/**
 * @param {FiberElement} fiber
 */
function updateFunctionComponent(fiber) {
    const functionChildren = [fiber.type(fiber.props)];
    reconcileChildren(fiber, functionChildren);
}
/**
 * @param {FiberElement} fiber 
 */
function performUnitOfWork(fiber) {
    // * 1. add dom node
    // * function components is different :
    // ** 1> the fiber from a function component doesn't have a dom node
    // ** 2> and the children come from running the function instead of getting them directly from the props

    // ? createElement({type: (function App() {}), ....})
    const isFunctionComponent = fiber.type instanceof Function;
    // * 2. create new fibers
    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }
    // * 3. return the next unit of work
    if (fiber.child) {
        return fiber.child;
    }
    let nextFiber = fiber;
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling;
        }
        nextFiber = nextFiber.parent;
    }
}

/**
 * @param {FiberElement} wipFiber
 * @param {Array<FiberElement>} elements
 */
function reconcileChildren(wipFiber, elements) {
    let index = 0;
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
    let prevSibling = null;
    while (index < elements.length || oldFiber != null) {
        const element = elements[index];
        let newFiber = null;
        const sameType = oldFiber && element && element.type === oldFiber.type;
        if (sameType) {
            // * Update
            newFiber = {
                type: oldFiber.type,
                dom: oldFiber.dom,
                alternate: oldFiber,
                parent: wipFiber,
                props: element.props,
                effectTag: "UPDATE"
            }
        }
        if (element && !sameType) {
            // * Insert
            newFiber = {
                type: element.type,
                props: element.props,
                parent: wipFiber,
                dom: null,
                alternate: null,
                effectTag: "PLACEMENT"
            };
        }
        if (oldFiber && !sameType) {
            oldFiber.effectTag = 'DELETION';
            deletions.push(oldFiber);
        }
        if (oldFiber) {
            oldFiber = oldFiber.sibling;
        }

        if (index === 0) {
            wipFiber.child = newFiber;
        } else if (element) {
            prevSibling.sibling = newFiber;
        }
        prevSibling = newFiber;
        index++;
    }
}

const OwnReact = {
    createElement,
    render
};


/** @jsx OwnReact.createElement */
const container = document.getElementById("root");

function App(props) {
    return <h1>Hi, {props.name}</h1>
}
const element = <App name="Own React Demo"/>;
OwnReact.render(element, container);
