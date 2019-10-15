/** @jsx h */

import { h } from '../../../helpers'

export const run = editor => {
  editor.removeTextAtPoint({ path: [0, 1, 0], offset: 0 }, 1)
}

export const input = (
  <value>
    <block>
      <text />
      <inline>
        <text>a</text>
      </inline>
      <text />
    </block>
  </value>
)

export const output = (
  <value>
    <block>
      <text />
      <inline>
        <text />
      </inline>
      <text />
    </block>
  </value>
)
