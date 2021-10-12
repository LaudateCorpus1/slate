import invariant from 'tiny-invariant'
import warning from 'tiny-warning'
import { Value } from 'slate'

import findPath from './find-path'
import findRange from './find-range'

/**
 * Get the target range from a DOM `event`.
 *
 * @param {Event} event
 * @param {Editor} editor
 * @return {Range}
 */

function getEventRange(event, editor) {
  warning(
    false,
    'As of slate-react@0.22 the `getEventRange(event, editor)` helper is deprecated in favor of `editor.findEventRange(event)`.'
  )

  invariant(
    !Value.isValue(editor),
    'As of Slate 0.42.0, the `findNode` utility takes an `editor` instead of a `value`.'
  )

  if (event.nativeEvent) {
    event = event.nativeEvent
  }

  const { clientX: x, clientY: y, target } = event
  if (x == null || y == null) return null

  const { value } = editor
  const { document } = value
  const path = findPath(event.target, editor)
  if (!path) return null

  const node = document.getNode(path)

  // If the drop target is inside a void node, move it into either the next or
  // previous node, depending on which side the `x` and `y` coordinates are
  // closest to.
  if (editor.isVoid(node)) {
    const rect = target.getBoundingClientRect()
    const isPrevious =
      node.object === 'inline'
        ? x - rect.left < rect.left + rect.width - x
        : y - rect.top < rect.top + rect.height - y

    const range = document.createRange()
    const move = isPrevious ? 'moveToEndOfNode' : 'moveToStartOfNode'
    const entry = document[isPrevious ? 'getPreviousText' : 'getNextText'](path)

    if (entry) {
      return range[move](entry)
    }

    return null
  }

  // Else resolve a range from the caret position where the drop occured.
  const doc = editor.ownerWindow.document
  let native

  // COMPAT: In Firefox, `caretRangeFromPoint` doesn't exist. (2016/07/25)
  if (doc.caretRangeFromPoint) {
    native = doc.caretRangeFromPoint(x, y)
  } else if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y)
    native = doc.createRange()
    native.setStart(position.offsetNode, position.offset)
    native.setEnd(position.offsetNode, position.offset)
  } else if (doc.body.createTextRange) {
    // COMPAT: In IE, `caretRangeFromPoint` and
    // `caretPositionFromPoint` don't exist. (2018/07/11)
    native = doc.body.createTextRange()

    try {
      native.moveToPoint(x, y)
    } catch (error) {
      // IE11 will raise an `unspecified error` if `moveToPoint` is
      // called during a dropEvent.
      return null
    }
  }

  // Resolve a Slate range from the DOM range.
  const range = findRange(native, editor)
  if (!range) return null

  return range
}

/**
 * Export.
 *
 * @type {Function}
 */

export default getEventRange
