interface Props {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  label: string;
}

export function Pager({ page, totalPages, onPage, label }: Props) {
  return (
    <nav className="pager" aria-label={`${label} pages`}>
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
        Next
      </button>
    </nav>
  );
}
