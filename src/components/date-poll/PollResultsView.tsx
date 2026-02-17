"use client"

import { Loader2, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { PollView } from "@/lib/date-poll/types"

function formatOption(value: string): string {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(parsedDate)
}

function optionsByDate(poll: PollView): PollView["options"] {
  return [...poll.options].sort(
    (a, b) => new Date(a.value).getTime() - new Date(b.value).getTime()
  )
}

type RemoveVoteState = {
  participantId: string
  participantName: string
} | null

export function PollResultsView({
  poll,
  canManageVotes = false,
}: {
  poll: PollView
  canManageVotes?: boolean
}) {
  const [pollState, setPollState] = useState(poll)
  const [removeVoteState, setRemoveVoteState] = useState<RemoveVoteState>(null)
  const [isRemovingVote, setIsRemovingVote] = useState(false)
  const [removeVoteError, setRemoveVoteError] = useState<string | null>(null)
  const sortedOptions = useMemo(() => optionsByDate(pollState), [pollState])

  async function confirmRemoveVotes() {
    if (!removeVoteState || isRemovingVote) return

    setIsRemovingVote(true)
    setRemoveVoteError(null)

    try {
      const response = await fetch(
        `/api/polls/${pollState.id}/participants/${encodeURIComponent(removeVoteState.participantId)}`,
        {
          method: "DELETE",
        }
      )

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; errors?: string[] }
        | { poll?: PollView }
        | null

      if (!response.ok) {
        if (payload && "errors" in payload && payload.errors?.length) {
          setRemoveVoteError(payload.errors.join(". "))
        } else if (payload && "error" in payload && payload.error) {
          setRemoveVoteError(payload.error)
        } else {
          setRemoveVoteError("Could not remove votes")
        }
        return
      }

      if (payload && "poll" in payload && payload.poll) {
        setPollState(payload.poll)
        setRemoveVoteState(null)
      } else {
        setRemoveVoteError("Could not remove votes")
      }
    } catch {
      setRemoveVoteError("Could not remove votes")
    } finally {
      setIsRemovingVote(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Results</CardTitle>
        <CardDescription>Dates are shown in chronological order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Option</TableHead>
              <TableHead>✅</TableHead>
              <TableHead>⚠️</TableHead>
              <TableHead>❌</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedOptions.map((option) => (
              <TableRow key={option.id}>
                <TableCell>{formatOption(option.value)}</TableCell>
                <TableCell>{option.canCount}</TableCell>
                <TableCell>{option.maybeCount}</TableCell>
                <TableCell>{option.cantCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Participants: {pollState.participants.length}</Badge>
          <Badge variant="outline">Options: {sortedOptions.length}</Badge>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Who voted what</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                {sortedOptions.map((option) => (
                  <TableHead key={option.id}>{formatOption(option.value)}</TableHead>
                ))}
                {canManageVotes ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pollState.participants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={sortedOptions.length + 1 + (canManageVotes ? 1 : 0)}
                    className="text-muted-foreground"
                  >
                    No votes yet.
                  </TableCell>
                </TableRow>
              ) : (
                pollState.participants.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell>{participant.fullName}</TableCell>
                    {sortedOptions.map((option) => {
                      const vote = participant.votes[option.id]
                      return (
                        <TableCell key={option.id}>
                          {vote === "can" ? "✅ can" : vote === "maybe" ? "⚠️ maybe" : "❌ can't"}
                        </TableCell>
                      )
                    })}
                    {canManageVotes ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Remove votes from ${participant.fullName}`}
                          onClick={() => {
                            setRemoveVoteState({
                              participantId: participant.id,
                              participantName: participant.fullName,
                            })
                            setRemoveVoteError(null)
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog
        open={removeVoteState !== null}
        onOpenChange={(open) => {
          if (!open && !isRemovingVote) {
            setRemoveVoteState(null)
            setRemoveVoteError(null)
          }
        }}
      >
        <DialogContent showCloseButton={!isRemovingVote}>
          <DialogHeader>
            <DialogTitle>Remove votes?</DialogTitle>
            <DialogDescription>
              {`Remove all votes from "${removeVoteState?.participantName ?? "this participant"}"? They can submit a new vote later.`}
            </DialogDescription>
          </DialogHeader>
          {removeVoteError ? <p className="text-sm text-destructive">{removeVoteError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isRemovingVote}
              onClick={() => setRemoveVoteState(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isRemovingVote}
              onClick={confirmRemoveVotes}
            >
              {isRemovingVote ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove votes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
