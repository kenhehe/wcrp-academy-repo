export interface DuplicateMatch {
  event_id:              string
  duplicate_event_id:    string
  duplicate_ipo_id:      string
  duplicate_title:       string
  duplicate_start_date:  string
  duplicate_url:         string | null
  score:                 number
}

export interface ReviewEventRow {
  id:         string
  ipo_id:     string
  title:      string
  start_date: string
  status:     string
  url:        string | null
}

export interface ConfirmedDuplicateRow {
  id:                     string
  ipo_id:                 string
  title:                  string
  start_date:             string
  url:                    string | null
  duplicate_of_event_id:  string
}
