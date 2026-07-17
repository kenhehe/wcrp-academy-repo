export interface IPOSidebarProps {
  ipoName:      string
  ipoId:        string
  colorHex:     string
  userEmail:    string
  ipoType:      'ipo' | 'lighthouse'
  canApprove:   boolean
  pendingCount: number
}
