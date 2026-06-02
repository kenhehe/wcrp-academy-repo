'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, Globe, Layers, Upload } from 'lucide-react'
import { createIPOUser, updateIPOUser, deleteIPOUser } from '@/app/dashboard/academy/accounts/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { IPOUser } from './types'
import { IPO_OPTIONS } from './types'

type Modal =
  | { type: 'create' }
  | { type: 'edit'; user: IPOUser }
  | { type: 'delete'; user: IPOUser }
  | null

export default function AccountsTable({ users }: { users: IPOUser[] }) {
  const [modal, setModal]     = useState<Modal>(null)
  const [pending, startTransition] = useTransition()

  function close() { setModal(null) }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createIPOUser(fd)
        toast.success('Account created')
        close()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create account')
      }
    })
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await updateIPOUser(fd)
        toast.success('Account updated')
        close()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update account')
      }
    })
  }

  function handleDelete(userId: string) {
    startTransition(async () => {
      try {
        await deleteIPOUser(userId)
        toast.success('Account deleted')
        close()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete account')
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{users.length} IPO account{users.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setModal({ type: 'create' })}>
          <Plus className="h-4 w-4 mr-2" />
          Add account
        </Button>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>IPO</TableHead>
              <TableHead>Event source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No IPO accounts yet
                </TableCell>
              </TableRow>
            )}
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="uppercase text-xs">
                    {user.org_id}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.source_type ? (
                    <div className="flex items-center gap-1.5">
                      {user.source_type === 'third_party' && <Layers className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                      {user.source_type === 'blocked'     && <Upload className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                      {user.source_type === 'html'        && <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                      <span className={`text-xs font-medium ${
                        user.source_type === 'third_party' ? 'text-purple-700 dark:text-purple-400' :
                        user.source_type === 'blocked'     ? 'text-orange-700 dark:text-orange-400' :
                                                             'text-blue-700 dark:text-blue-400'
                      }`}>
                        {user.source_label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModal({ type: 'edit', user })}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setModal({ type: 'delete', user })}
                      className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
            <DialogTitle>Add IPO account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" name="email" type="email" required placeholder="user@ipo.org" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-password">Password</Label>
              <Input id="c-password" name="password" type="password" required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-org">IPO</Label>
              <Select name="org_id" required>
                <SelectTrigger id="c-org">
                  <SelectValue placeholder="Select IPO…" />
                </SelectTrigger>
                <SelectContent>
                  {IPO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      {modal?.type === 'edit' && (
        <Dialog open onOpenChange={open => !open && close()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <input type="hidden" name="user_id" value={modal.user.id} />
              <div className="space-y-2">
                <Label htmlFor="e-email">Email</Label>
                <Input id="e-email" name="email" type="email" defaultValue={modal.user.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-password">New password <span className="text-muted-foreground">(leave blank to keep)</span></Label>
                <Input id="e-password" name="password" type="password" minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-org">IPO</Label>
                <Select name="org_id" defaultValue={modal.user.org_id}>
                  <SelectTrigger id="e-org">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IPO_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      {modal?.type === 'delete' && (
        <AlertDialog open onOpenChange={open => !open && close()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{modal.user.email}</strong> and revoke their access.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={close}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(modal.user.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={pending}
              >
                {pending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
