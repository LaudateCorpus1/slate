import React from 'react'
import { getRelativeRange } from './block'

import Text from './text'
import DATA_ATTRS from '../constants/data-attributes'

export default class Inline extends React.Component {
  tmp = { nodeRefs: {} }
  ref = React.createRef()

  shouldComponentUpdate(nextProps) {
    return this.props.node !== nextProps.node
  }

  render() {
    const { editor, node, parent } = this.props

    const decorations = node.getDecorations(editor)
    const children = []

    if (
      node.nodes.length > 1 ||
      (node.nodes.length === 1 && node.nodes.first().text !== ' ')
    ) {
      for (const child of node.nodes) {
        const i = children.length

        const refFn = ref => {
          if (ref) {
            this.tmp.nodeRefs[i] = ref
          } else {
            delete this.tmp.nodeRefs[i]
          }
        }

        if (child.object === 'inline') {
          const decs = decorations
            .map(d => getRelativeRange(node, i, d))
            .filter(d => d)

          children.push(
            <Inline
              ref={refFn}
              key={child.key}
              editor={editor}
              node={child}
              parent={node}
              decorations={decs}
            />
          )
        } else {
          const decs = decorations
            .map(d => getRelativeRange(node, i, d))
            .filter(d => d)

          children.push(
            <Text
              ref={refFn}
              key={child.key}
              editor={editor}
              node={child}
              parent={node}
              decorations={decs}
            />
          )
        }
      }
    }

    // Attributes that the developer must mix into the element in their
    // custom node renderer component.
    const attributes = {
      [DATA_ATTRS.OBJECT]: node.object,
      [DATA_ATTRS.KEY]: node.key,
      ref: this.ref,
    }

    return editor.run('renderInline', {
      attributes,
      children,
      editor,
      node,
      parent,
    })
  }
}
