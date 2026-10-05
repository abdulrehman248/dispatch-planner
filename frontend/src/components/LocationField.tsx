import { useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, CircularProgress, TextField } from '@mui/material';
import { searchLocations } from '../api';
import type { Location } from '../types';

type Props = {
  label: string;
  value: Location | null;
  onChange: (location: Location | null) => void;
  disabled: boolean;
};

export default function LocationField({ label, value, onChange, disabled }: Props) {
  const [query, setQuery] = useState(value?.label || '');
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (value) {
      setQuery(value.label);
      setResults([value]);
    }
    setError('');
  }, [value]);
  useEffect(() => {
    controller.current?.abort();
    setLoading(false);
    if (query.trim().length < 3 || query === value?.label) return;
    setResults([]);
    setLoading(true);
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await searchLocations(query, abort.signal);
        if (!abort.signal.aborted) setResults(response.results);
      } catch (e) {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : 'Location search unavailable.');
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 650);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, value]);
  return (
    <div className="location-field">
      <Autocomplete
        disabled={disabled}
        options={results}
        value={value}
        inputValue={query}
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.label}
        getOptionKey={(option) => `${option.label}:${option.coordinates.join(',')}`}
        isOptionEqualToValue={(a, b) =>
          a.label === b.label && a.coordinates.join() === b.coordinates.join()
        }
        onChange={(_, next) => {
          setQuery(next?.label || '');
          onChange(next);
        }}
        onInputChange={(_, next, reason) => {
          if (reason === 'input') {
            setQuery(next);
            if (value) onChange(null);
          }
        }}
        loading={loading}
        noOptionsText={
          query.length < 3 ? 'Type a US city or address' : 'No matches. Try city and state.'
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            size="small"
            placeholder="City or address"
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading && <CircularProgress size={16} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
      {error && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </div>
  );
}
