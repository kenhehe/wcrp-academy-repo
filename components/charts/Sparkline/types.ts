export interface SparklineProps {
  values:     number[]   // oldest first; the last point is the current period
  label:      string     // accessible summary of the series
  className?: string
}
