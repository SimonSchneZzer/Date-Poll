export type AccountPollSummary = {
  id: string
  title: string
  path: string
  role: "organizer" | "participant"
  lastInteractionAt: string
}
