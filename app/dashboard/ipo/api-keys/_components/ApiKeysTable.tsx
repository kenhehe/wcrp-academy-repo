'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react'
import { generateApiToken, revokeApiToken } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface ApiToken {
  id:           string
  name:         string
  token_prefix: string
  created_at:   string
  last_used_at: string | null
}

type Modal =
  | { type: 'create' }
  | { type: 'reveal'; token: string }
  | { type: 'revoke'; item: ApiToken }
  | null

export default function ApiKeysTable({ tokens }: { tokens: ApiToken[] }) {
  const [modal, setModal]          = useState<Modal>(null)
  const [pending, startTransition] = useTransition()

  function close() { setModal(null) }

  function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const { rawToken } = await generateApiToken(fd)
        setModal({ type: 'reveal', token: rawToken })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to generate token')
      }
    })
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      try {
        await revokeApiToken(id)
        toast.success('Token revoked')
        close()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to revoke token')
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {tokens.length} token{tokens.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setModal({ type: 'create' })}>
          <Plus className="h-4 w-4 mr-2" />
          Generate token
        </Button>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No API tokens yet
                </TableCell>
              </TableRow>
            )}
            {tokens.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">
                    {t.token_prefix}••••••••••••••••••••••••
                  </code>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : 'Never'}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => setModal({ type: 'revoke', item: t })}
                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create modal */}
      <Dialog open={modal?.type === 'create'} onOpenChange={open => !open && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API token</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Token name</Label>
              <Input id="name" name="name" required placeholder="e.g. WCRP Website" />
            </div>
            <p className="text-xs text-muted-foreground">
              The token will only be shown once after generation. Store it somewhere safe.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Generating…' : 'Generate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reveal token — shown once after generation */}
      {modal?.type === 'reveal' && (
        <RevealDialog token={modal.token} onClose={close} />
      )}

      {/* Revoke confirm */}
      {modal?.type === 'revoke' && (
        <AlertDialog open onOpenChange={open => !open && close()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke token?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{modal.item.name}</strong> will stop working immediately.
                Any system using it will lose access. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={close}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleRevoke(modal.item.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={pending}
              >
                {pending ? 'Revoking…' : 'Revoke'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

function RevealDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  function copy() {
    navigator.clipboard.writeText(token)
    toast.success('Token copied to clipboard')
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your new API token</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted p-3 flex items-center gap-2">
            <code className="flex-1 text-xs break-all">
              {visible ? token : token.slice(0, 12) + '•'.repeat(token.length - 12)}
            </code>
            <button onClick={() => setVisible(v => !v)} className="shrink-0 text-muted-foreground hover:text-foreground">
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button onClick={copy} className="shrink-0 text-muted-foreground hover:text-foreground">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-destructive font-medium">
            Copy this token now. It will not be shown again.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
