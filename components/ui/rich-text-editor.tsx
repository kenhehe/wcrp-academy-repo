'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  List, ListOrdered, Link2, Unlink, Undo, Redo,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        'p-1.5 rounded text-sm transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      )}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'min-h-[160px] px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none',
        'data-placeholder': placeholder ?? '',
      },
    },
  })

  if (!editor) return null

  const addLink = () => {
    const url = window.prompt('URL')
    if (!url) return
    editor.chain().focus().extendMarkToLink({ href: url }).setLink({ href: url }).run()
  }

  return (
    <div className={cn('rounded-md border border-input bg-background', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton onClick={addLink} active={editor.isActive('link')} title="Add link">
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()}
          active={false} title="Remove link">
          <Unlink className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo" active={false}>
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo()} title="Redo" active={false}>
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  )
}
