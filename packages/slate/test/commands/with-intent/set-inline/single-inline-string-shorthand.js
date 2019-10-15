/** @jsx h */

import { h } from '../../../helpers'

export const run = editor => {
  editor.setInlines('hashtag')
}

export const input = (
  <value>
    
      <block>
        <inline>
          <cursor />word
        </inline>
      </block>
    
  </value>
)

export const output = (
  <value>
    
      <block>
        <inline>
          <cursor />word
        </inline>
      </block>
    
  </value>
)
