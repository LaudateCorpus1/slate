import React from 'react'
import { PathUtils } from 'slate'

import Inline from './inline'
import Text from './text'
import DATA_ATTRS from '../constants/data-attributes'

export default class Block extends React.Component {
  tmp = { nodeRefs: {} }
  ref = React.createRef()

  shouldComponentUpdate(nextProps) {
    return this.props.node !== nextProps.node
  }

  render() {
    const { editor, node, parent } = this.props

    const decorations = node.getDecorations(editor)
    const children = []

    for (const child of node.nodes) {
      const i = children.length

      const refFn = ref => {
        if (ref) {
          this.tmp.nodeRefs[i] = ref
        } else {
          delete this.tmp.nodeRefs[i]
        }
      }

      if (child.object === 'block') {
        children.push(
          <Block
            ref={refFn}
            key={child.key}
            editor={editor}
            node={child}
            parent={node}
          />
        )
      } else if (child.object === 'inline') {
        children.push(
          <Inline
            ref={refFn}
            key={child.key}
            editor={editor}
            node={child}
            parent={node}
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

    // Attributes that the developer must mix into the element in their
    // custom node renderer component.
    const attributes = {
      [DATA_ATTRS.OBJECT]: node.object,
      [DATA_ATTRS.KEY]: node.key,
      ref: this.ref,
    }

    // If it's a block node with inline children, add the proper `dir` attribute
    // for text direction.
    if (node.isLeafBlock()) {
      const direction = node.getTextDirection()
      if (direction === 'rtl') attributes.dir = 'rtl'
    }

    return editor.run('renderBlock', {
      attributes,
      children,
      editor,
      node,
      parent,
    })
  }
}

/**
 * Return a `range` relative to a child at `index`.
 *
 * @param {Range} range
 * @param {Number} index
 * @return {Range}
 */

export function getRelativeRange(node, index, range) {
  if (range.isUnset) {
    return null
  }

  const child = node.nodes.get(index)
  let { start, end } = range
  const { path: startPath } = start
  const { path: endPath } = end
  const startIndex = startPath.first()
  const endIndex = endPath.first()

  if (startIndex === index) {
    start = start.setPath(startPath.rest())
  } else if (startIndex < index && index <= endIndex) {
    if (child.object === 'text') {
      start = start.moveTo(PathUtils.create([index]), 0).setKey(child.key)
    } else {
      const [first] = child.texts()
      const [firstNode, firstPath] = first
      start = start.moveTo(firstPath, 0).setKey(firstNode.key)
    }
  } else {
    start = null
  }

  if (endIndex === index) {
    end = end.setPath(endPath.rest())
  } else if (startIndex <= index && index < endIndex) {
    if (child.object === 'text') {
      const length = child.text.length
      end = end.moveTo(PathUtils.create([index]), length).setKey(child.key)
    } else {
      const [last] = child.texts({ direction: 'backward' })
      const [lastNode, lastPath] = last
      end = end.moveTo(lastPath, lastNode.text.length).setKey(lastNode.key)
    }
  } else {
    end = null
  }

  if (!start || !end) {
    return null
  }

  range = range.setAnchor(start)
  range = range.setFocus(end)
  return range
}
