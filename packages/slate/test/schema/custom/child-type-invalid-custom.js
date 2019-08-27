/** @jsx h */

import h from '../../helpers/h'

export const schema = {
  blocks: {
    paragraph: {},
    quote: {
      nodes: [
        {
          match: [{ type: 'paragraph' }],
        },
      ],
      normalize: (editor, { code, path }) => {
        if (code === 'child_type_invalid') {
          editor.wrapBlockByPath(path, 'paragraph')
        }
      },
    },
  },
}

export const input = (
  <value>
    <document>
      <quote>
        <image>
          <text />
        </image>
      </quote>
    </document>
  </value>
)

export const output = (
  <value>
    <document>
      <quote>
        <paragraph>
          <image>
            <text />
          </image>
        </paragraph>
      </quote>
    </document>
  </value>
)
