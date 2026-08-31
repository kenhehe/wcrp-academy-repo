export interface DuplicatePair {
  event_id:              string
  event_ipo_id:          string
  event_title:           string
  event_start_date:      string
  event_url:             string | null
  duplicate_event_id:    string
  duplicate_ipo_id:      string
  duplicate_title:       string
  duplicate_start_date:  string
  duplicate_url:         string | null
  score:                 number
  total_count:           number
}

export interface ConfirmedDuplicateRow {
  id:                     string
  ipo_id:                 string
  title:                  string
  start_date:             string
  url:                    string | null
  duplicate_of_event_id:  string
}
