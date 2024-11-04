const TEXT_ELEMENT = 'text';

const isProperty = key => key !== 'children';
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next);

/**
 * @param {string} type 
 * @param {Record<string, any>} props 
 * @param  {...any} children 
 * @typedef {{type: string;
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
    Object.keys(fiber.props).filter(isProperty).forEach(p => dom[p] = fiber.props[p]);

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
    // * remove old properties
    Object.keys(oldProps)
    .filter(isProperty)
    .filter(isGone(oldProps, props))
    .forEach(p => dom[p] = '');
    // * set new or changed properties
    Object.keys(props)
    .filter(isProperty)
    .filter(isNew(oldProps, props))
    .forEach(p => dom[p] = props[p]);
}

/**
 * @param {FiberElement} fiber 
 */
function commitWork(fiber) {
    if (!fiber) return;
    const parentDom = fiber.parent.dom;

    if (fiber.effectTag === 'DELETION') {
        parentDom.removeChild(fiber.dom)
    }
    if (fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
        parentDom.appendChild(fiber.dom);
    }
    if (fiber.effectTag === 'UPDATE' && fiber.dom !== null)  {
        updateDom(fiber.parent.dom, fiber.props, fiber.alternate.props);
    }

    parentDom.appendChild(fiber.dom);
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
function performUnitOfWork(fiber) {
    // * 1. add dom node
    if (!fiber.dom) {
        fiber.dom = createDom(fiber);
    }
    // * 2. create new fibers
    const elements = fiber.props.children;
    reconcileChildren(fiber, elements);
    // * 3. return the next unit of work
    if (fiber.child) {
        return fiber.child;
    }
    let nextFiber = fiber;
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling;
        }
        nextFiber = fiber.parent;
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
    while (index < elements.length || oldFiber !== null) {
        const element = elements[index];
        let newFiber = null;
        const sameType = oldFiber?.type === element?.type;
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
            prevSibling = null;
        } else {
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

const root = document.getElementById('root');
// const element = OwnReact.createElement('h1', {}, 'Own React Demo')
/** @jsx OwnReact.createElement */
const element = <h1>Own React Demo</h1>
OwnReact.render(element, root);