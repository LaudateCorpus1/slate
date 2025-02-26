import Base64 from 'slate-base64-serializer'
import Debug from 'debug'
import Hotkeys from 'slate-hotkeys'
import Plain from 'slate-plain-serializer'
import getWindow from 'get-window'
import { IS_IOS, IS_IE, IS_EDGE } from 'slate-dev-environment'

import cloneFragment from '../../utils/clone-fragment'
import getEventTransfer from '../../utils/get-event-transfer'
import setEventTransfer from '../../utils/set-event-transfer'

/**
 * Debug.
 *
 * @type {Function}
 */

const debug = Debug('slate:after')

/**
 * A plugin that adds the "after" browser-specific logic to the editor.
 *
 * @param {Object} options
 * @return {Object}
 */

function AfterPlugin(options = {}) {
  let isDraggingInternally = null
  let isMouseDown = false

  /**
   * On before input.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onBeforeInput(event, editor, next) {
    const { value } = editor

    // Otherwise, we can use the information in the `beforeinput` event to
    // figure out the exact change that will occur, and prevent it.
    const [targetRange] = event.getTargetRanges()
    if (!targetRange) return next()

    debug('onBeforeInput', { event })

    event.preventDefault()

    const { document, selection } = value
    const range = editor.findRange(targetRange)

    switch (event.inputType) {
      case 'deleteByDrag':
      case 'deleteByCut':
      case 'deleteContent':
      case 'deleteContentBackward':
      case 'deleteContentForward': {
        editor.deleteAtRange(range)
        break
      }

      case 'deleteWordBackward': {
        editor.deleteWordBackwardAtRange(range)
        break
      }

      case 'deleteWordForward': {
        editor.deleteWordForwardAtRange(range)
        break
      }

      case 'deleteSoftLineBackward':
      case 'deleteHardLineBackward': {
        editor.deleteLineBackwardAtRange(range)
        break
      }

      case 'deleteSoftLineForward':
      case 'deleteHardLineForward': {
        editor.deleteLineForwardAtRange(range)
        break
      }

      case 'insertLineBreak':
      case 'insertParagraph': {
        const hasVoidParent = document.hasVoidParent(
          selection.start.path,
          editor
        )

        if (hasVoidParent) {
          editor.moveToStartOfNextText()
        } else {
          editor.splitBlockAtRange(range)
        }

        break
      }

      case 'insertFromYank':
      case 'insertReplacementText':
      case 'insertText': {
        // COMPAT: `data` should have the text for the `insertText` input type
        // and `dataTransfer` should have the text for the
        // `insertReplacementText` input type, but Safari uses `insertText` for
        // spell check replacements and sets `data` to `null`. (2018/08/09)
        const text =
          event.data == null
            ? event.dataTransfer.getData('text/plain')
            : event.data

        if (text == null) break

        editor.insertTextAtRange(range, text, selection.marks)

        // If the text was successfully inserted, and the selection had marks
        // on it, unset the selection's marks.
        if (selection.marks && value.document !== editor.value.document) {
          editor.select({ marks: null })
        }

        break
      }
    }

    next()
  }

  /**
   * On blur.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onBlur(event, editor, next) {
    debug('onBlur', { event })
    editor.blur()
    next()
  }

  /**
   * On click.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onClick(event, editor, next) {
    if (editor.readOnly) return next()

    const { value } = editor
    const { document } = value
    const path = editor.findPath(event.target)
    if (!path) return next()

    debug('onClick', { event })

    const node = document.getNode(path)
    const ancestors = document.getAncestors(path)
    const isVoid =
      node && (editor.isVoid(node) || ancestors.some(a => editor.isVoid(a)))

    if (isVoid) {
      // COMPAT: In Chrome & Safari, selections that are at the zero offset of
      // an inline node will be automatically replaced to be at the last offset
      // of a previous inline node, which screws us up, so we always want to set
      // it to the end of the node. (2016/11/29)
      editor.focus().moveToEndOfNode(node)
    }

    next()
  }

  /**
   * On copy.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onCopy(event, editor, next) {
    debug('onCopy', { event })
    cloneFragment(event, editor)
    next()
  }

  /**
   * On cut.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onCut(event, editor, next) {
    debug('onCut', { event })

    // Once the fake cut content has successfully been added to the clipboard,
    // delete the content in the current selection.
    cloneFragment(event, editor, () => {
      // If user cuts a void block node or a void inline node,
      // manually removes it since selection is collapsed in this case.
      const { value } = editor
      const { document, selection } = value
      const { end, isCollapsed } = selection
      let voidPath

      if (isCollapsed) {
        for (const [node, path] of document.ancestors(end.path)) {
          if (editor.isVoid(node)) {
            voidPath = path
            break
          }
        }
      }

      if (voidPath) {
        editor.removeNodeByKey(voidPath)
      } else {
        editor.delete()
      }
    })

    next()
  }

  /**
   * On drag end.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onDragEnd(event, editor, next) {
    debug('onDragEnd', { event })
    isDraggingInternally = null
    next()
  }

  /**
   * On drag start.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onDragStart(event, editor, next) {
    debug('onDragStart', { event })

    isDraggingInternally = true

    const { value } = editor
    const { document } = value
    const path = editor.findPath(event.target)
    const node = document.getNode(path)
    const ancestors = document.getAncestors(path)
    const isVoid =
      node && (editor.isVoid(node) || ancestors.some(a => editor.isVoid(a)))
    const selectionIncludesNode = value.blocks.some(block => block === node)

    // If a void block is dragged and is not selected, select it (necessary for local drags).
    if (isVoid && !selectionIncludesNode) {
      editor.moveToRangeOfNode(node)
    }

    const fragment = editor.value.fragment
    const encoded = Base64.serializeNode(fragment)
    setEventTransfer(event, 'fragment', encoded)
    next()
  }

  /**
   * On drop.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onDrop(event, editor, next) {
    const { value } = editor
    const { document, selection } = value
    const window = getWindow(event.target)
    const target = editor.findEventRange(event)

    if (!target) {
      return next()
    }

    debug('onDrop', { event })

    const transfer = getEventTransfer(event)
    const { type, fragment, text } = transfer

    editor.focus()

    // COMPAT: React's onSelect event breaks after an onDrop event
    // has fired in a node: https://github.com/facebook/react/issues/11379.
    // Until this is fixed in React, we dispatch a mouseup event on that
    // DOM node, since that will make it go back to normal.
    const el = editor.findDOMNode(target.focus.path)

    if (el) {
      el.dispatchEvent(
        new MouseEvent('mouseup', {
          view: window,
          bubbles: true,
          cancelable: true,
        })
      )
    }

    const draggedRange = selection

    editor.select(target)

    if (isDraggingInternally) {
      editor.deleteAtRange(draggedRange)
    }

    if (type === 'text' || type === 'html') {
      const { anchor } = target
      let hasVoidParent = document.hasVoidParent(anchor.path, editor)

      if (hasVoidParent) {
        let p = anchor.path
        let n = document.getNode(anchor.path)

        while (hasVoidParent) {
          const [nxt] = document.texts({ path: p })

          if (!nxt) {
            break
          }

          ;[n, p] = nxt
          hasVoidParent = document.hasVoidParent(p, editor)
        }

        if (n) editor.moveToStartOfNode(n)
      }

      if (text) {
        text.split('\n').forEach((line, i) => {
          if (i > 0) editor.splitBlock()
          editor.insertText(line)
        })
      }
    }

    if (type === 'fragment') {
      editor.insertFragment(fragment)
    }

    next()
  }

  /**
   * On focus.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onFocus(event, editor, next) {
    debug('onFocus', { event })

    // COMPAT: If the focus event is a mouse-based one, it will be shortly
    // followed by a `selectionchange`, so we need to deselect here to prevent
    // the old selection from being set by the `updateSelection` of `<Content>`,
    // preventing the `selectionchange` from firing. (2018/11/07)
    if (isMouseDown && !IS_IE && !IS_EDGE) {
      editor.deselect().focus()
    } else {
      editor.focus()
    }

    next()
  }

  /**
   * On input.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onInput(event, editor, next) {
    debug('onInput')

    const domSelection = editor.ownerWindow.getSelection()
    const selection = editor.findSelection(domSelection)

    if (selection) {
      editor.select(selection)
    } else {
      editor.blur()
    }

    // prettier-ignore
    if (window.ENABLE_SLATE_LOGGING) console.log('    flush selAfterOnInput:', JSON.stringify(editor.value.selection.toJSON()))

    const { anchorNode } = domSelection
    editor.reconcileDOMNode(anchorNode)

    // prettier-ignore
    if (window.ENABLE_SLATE_LOGGING) console.log('    flush selAfterReconci:', JSON.stringify(editor.value.selection.toJSON()))
    // prettier-ignore
    if (window.ENABLE_SLATE_LOGGING) console.log(`    editor: len: ${editor.value.document.text.length} selSlate: ${editor.value.selection.anchor.offset} selNative: ${editor.ownerWindow.getSelection().anchorOffset} document: ${JSON.stringify(editor.value.document.toJSON())}`)

    next()
  }

  /**
   * On key down.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onKeyDown(event, editor, next) {
    debug('onKeyDown', { event })

    const { value } = editor
    const { document, selection } = value
    const { start } = selection

    const selectedBlock = document.getClosestBlock(start.path)
    const isRtl =
      selectedBlock != null && selectedBlock.getTextDirection() === 'rtl'

    if (Hotkeys.isDeleteBackward(event) && !IS_IOS) {
      return editor.deleteCharBackward()
    }

    if (Hotkeys.isDeleteForward(event) && !IS_IOS) {
      return editor.deleteCharForward()
    }

    if (Hotkeys.isDeleteLineBackward(event)) {
      return editor.deleteLineBackward()
    }

    if (Hotkeys.isDeleteLineForward(event)) {
      return editor.deleteLineForward()
    }

    if (Hotkeys.isDeleteWordBackward(event)) {
      return editor.deleteWordBackward()
    }

    if (Hotkeys.isDeleteWordForward(event)) {
      return editor.deleteWordForward()
    }

    if (Hotkeys.isRedo(event)) {
      return editor.redo()
    }

    if (Hotkeys.isUndo(event)) {
      return editor.undo()
    }

    // COMPAT: Certain browsers don't handle the selection updates properly. In
    // Chrome, the selection isn't properly extended. And in Firefox, the
    // selection isn't properly collapsed. (2017/10/17)
    if (Hotkeys.isMoveLineBackward(event)) {
      event.preventDefault()
      return isRtl ? editor.moveToEndOfBlock() : editor.moveToStartOfBlock()
    }

    if (Hotkeys.isMoveLineForward(event)) {
      event.preventDefault()
      return isRtl ? editor.moveToStartOfBlock() : editor.moveToEndOfBlock()
    }

    if (Hotkeys.isExtendLineBackward(event)) {
      event.preventDefault()
      return isRtl
        ? editor.moveFocusToEndOfBlock()
        : editor.moveFocusToStartOfBlock()
    }

    if (Hotkeys.isExtendLineForward(event)) {
      event.preventDefault()
      return isRtl
        ? editor.moveFocusToStartOfBlock()
        : editor.moveFocusToEndOfBlock()
    }

    // COMPAT: If a void node is selected, or a zero-width text node adjacent to
    // an inline is selected, we need to handle these hotkeys manually because
    // browsers won't know what to do.
    if (Hotkeys.isMoveBackward(event)) {
      event.preventDefault()

      if (!selection.isCollapsed) {
        return isRtl ? editor.moveToEnd() : editor.moveToStart()
      }

      return isRtl ? editor.moveForward() : editor.moveBackward()
    }

    if (Hotkeys.isMoveForward(event)) {
      event.preventDefault()

      if (!selection.isCollapsed) {
        return isRtl ? editor.moveToStart() : editor.moveToEnd()
      }

      return isRtl ? editor.moveBackward() : editor.moveForward()
    }

    if (Hotkeys.isMoveWordBackward(event)) {
      event.preventDefault()
      return isRtl ? editor.moveWordForward() : editor.moveWordBackward()
    }

    if (Hotkeys.isMoveWordForward(event)) {
      event.preventDefault()
      return isRtl ? editor.moveWordBackward() : editor.moveWordForward()
    }

    if (
      (!isRtl && Hotkeys.isExtendBackward(event)) ||
      (isRtl && Hotkeys.isExtendForward(event))
    ) {
      event.preventDefault()
      return editor.moveFocusBackward()
    }

    if (
      (!isRtl && Hotkeys.isExtendForward(event)) ||
      (isRtl && Hotkeys.isExtendBackward(event))
    ) {
      event.preventDefault()
      return editor.moveFocusForward()
    }

    next()
  }

  /**
   * On mouse down.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onMouseDown(event, editor, next) {
    debug('onMouseDown', { event })
    isMouseDown = true
    next()
  }

  /**
   * On mouse up.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onMouseUp(event, editor, next) {
    debug('onMouseUp', { event })
    isMouseDown = false
    next()
  }

  /**
   * On paste.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onPaste(event, editor, next) {
    debug('onPaste', { event })

    const { value } = editor
    const transfer = getEventTransfer(event)
    const { type, fragment, text } = transfer

    if (type === 'fragment') {
      editor.insertFragment(fragment)
    }

    if (type === 'text' || type === 'html') {
      if (!text) return next()
      const { document, selection, startBlock } = value
      if (editor.isVoid(startBlock)) return next()

      const defaultBlock = startBlock
      const defaultMarks = document.getInsertMarksAtRange(selection)
      const frag = Plain.deserialize(text, { defaultBlock, defaultMarks })
        .document
      editor.insertFragment(frag)
    }

    next()
  }

  /**
   * On select.
   *
   * @param {Event} event
   * @param {Editor} editor
   * @param {Function} next
   */

  function onSelect(event, editor, next) {
    debug('onSelect', { event })
    const domSelection = editor.ownerWindow.getSelection()
    const selection = editor.findSelection(domSelection)
    // prettier-ignore
    if (window.ENABLE_SLATE_LOGGING && domSelection && editor.value.selection.anchor && selection && selection.anchor) console.log(`!! onSelect domOffset:${domSelection.anchorOffset} oldSlate: ${editor.value.selection.anchor.offset} newSlate: ${selection.anchor.offset}`)

    if (selection) {
      editor.select(selection)
    } else {
      editor.blur()
    }

    // COMPAT: reset the `isMouseDown` state here in case a `mouseup` event
    // happens outside the editor. This is needed for `onFocus` handling.
    isMouseDown = false

    next()
  }

  /**
   * Return the plugin.
   *
   * @type {Object}
   */

  return {
    onBeforeInput,
    onBlur,
    onClick,
    onCopy,
    onCut,
    onDragEnd,
    onDragStart,
    onDrop,
    onFocus,
    onInput,
    onKeyDown,
    onMouseDown,
    onMouseUp,
    onPaste,
    onSelect,
  }
}

/**
 * Export.
 *
 * @type {Function}
 */

export default AfterPlugin
