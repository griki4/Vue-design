// 传统Diff算法即使模板发生微小变化，也会比对虚拟DOM的所有层级
const PatchFlags = {
    TEXT: 1,
    CLASS: 2,
    STYLE: 3
}

const dynamicChildrenStack = []
let currentDynamicChildren = null
function openBlock() {
    dynamicChildrenStack.push((currentDynamicChildren = []))
}
function closeStack() {
    dynamicChildrenStack.pop()
}
// 创建虚拟节点的辅助函数会将有标志的动态节点搜集到currentDynamicChildren中
function createVNode(tag, props, children, flag) {
    const key = props && props.key
    props && delete props.key
    const vnode = {
        tag,
        props,
        children,
        key,
        patchFlags: flag
    }

    if (typeof flag !== 'undefined' && currentDynamicChildren) {
        currentDynamicChildren.push(vnode)
    }

    return vnode
}
// 创建动态根节点的函数，搜集当前动态节点
// 组件的根节点和带有vue指令的节点，都是Block
function createBlock(tag, props, children) {
    const block = createVNode(tag, props, children)
    block.dynamicChildren = currentDynamicChildren
    closeStack()
    return block
}
// 修改后的渲染函数
function render(ctx, cache) {
    // cache参数用于缓存内联事件，避免无效更新
    return (openBlock(), createBlock('div', null, [
        createVNode('p', { class: 'foo' }, null, 1),
        createVNode('p', { class: 'bar' }, null),
    ]))
}

// 修改后的patchElement函数
function patchElement(n1, n2) {
    const el = n1.el = n2.el
    const oldProps = n1.props
    const newProps = n2.props

    // props靶向更新
    if (n2.patchFlags) {
        if (n2.patchFlags === 1) {
            // 更新文本
        } else if (n2.patchFlags === 2) {
            // 更新class
        } else if (n2.patchFlags === 3) {
            // 更新style
        }
    } else {
        // 不存在标识则全量更新
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key])
                }
            }
        for (const key in oldProps) {
            if (!(key in newProps)) {
                patchProps(el, key, oldProps[key], null)
            }
        }
    }

    if (n2.dynamicChildren) {
        // dynamicChildren数组存在，则直接更新内部的节点，忽略静态节点
        patchBlockChildren(n1, n2)
    } else {
        patchChildren(n1, n2, el)
    }
}
function patchBlockChildren(n1, n2) {
    for (let i = 0; i < n2.dynamicChildren.length; i++) {
        patchElement(n1.dynamicChildren[i], n2.dynamicChildren[i])
    }
}

// 更新优化。patch时优先根据dynamicChildren数组靶向更新对应的动态节点。
// 生成虚拟DOM优化。将静态的节点和属性提升到渲染函数之外，后续生成新的虚拟DOM时创建静态节点直接使用外部提升出来的节点即可。

