const TEXT_ELEMENT = 'text';

const isProperty = key => key !== 'chidlren';

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
 * 
 * @param {ReactElement} element 
 * @param {HTMLDivElement} container 
 */
function render(element, container) {
    const {type, props} = element;
    const dom = type === TEXT_ELEMENT ? document.createTextNode("") : document.createElement(type);
    Object.keys(props).filter(isProperty).forEach(p => {
        dom[p] = props[p];
    });
    props.children.forEach(c => {
        render(c, dom);
    });

    container.appendChild(dom);
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

const OwnReact = {
    createElement,
    render
};

const root = document.getElementById('root');
const element = OwnReact.createElement('h1', {}, 'Own React Demo')

OwnReact.render(element, root);