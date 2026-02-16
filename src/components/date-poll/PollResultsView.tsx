import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

export function PollResultsView({ poll }: { poll: PollView }) {
  const sortedOptions = optionsByDate(poll)

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
          <Badge variant="outline">Participants: {poll.participants.length}</Badge>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {poll.participants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={sortedOptions.length + 1} className="text-muted-foreground">
                    No votes yet.
                  </TableCell>
                </TableRow>
              ) : (
                poll.participants.map((participant) => (
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
