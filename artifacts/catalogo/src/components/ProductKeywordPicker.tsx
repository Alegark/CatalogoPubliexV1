import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Trash2, X } from "lucide-react";

const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LENGTH = 60;
const MAX_VISIBLE_SUGGESTIONS = 50;

type ProductKeywordPickerProps = {
  id: string;
  value: string[];
  suggestions?: string[];
  loading?: boolean;
  error?: boolean;
  disabled?: boolean;
  deletingKeyword?: string | null;
  placeholder?: string;
  onChange: (keywords: string[]) => void;
  onDeleteSuggestion?: (keyword: string) => void;
};

function cleanKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function keywordKey(value: string): string {
  return cleanKeyword(value).toLocaleLowerCase("es-VE");
}

function uniqueKeywords(values: string[]): string[] {
  const seen = new Set<string>();
  return values.reduce<string[]>((result, value) => {
    const keyword = cleanKeyword(value);
    const key = keywordKey(keyword);
    if (!keyword || keyword.length > MAX_KEYWORD_LENGTH || seen.has(key)) return result;
    seen.add(key);
    result.push(keyword);
    return result;
  }, []).slice(0, MAX_KEYWORDS);
}

export function ProductKeywordPicker({
  id,
  value,
  suggestions = [],
  loading = false,
  error = false,
  disabled = false,
  deletingKeyword = null,
  placeholder,
  onChange,
  onDeleteSuggestion,
}: ProductKeywordPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedback, setFeedback] = useState("");

  const selectedKeys = new Set(value.map(keywordKey));
  const normalizedDraft = cleanKeyword(draft);
  const normalizedSearch = normalizedDraft.toLocaleLowerCase("es-VE");
  const matchingSuggestions = suggestions
    .map(cleanKeyword)
    .filter((suggestion, index, all) => all.findIndex((item) => keywordKey(item) === keywordKey(suggestion)) === index)
    .filter((suggestion) => !normalizedSearch || keywordKey(suggestion).includes(normalizedSearch));
  const visibleSuggestions = matchingSuggestions.slice(0, MAX_VISIBLE_SUGGESTIONS);
  const exactSuggestion = matchingSuggestions.find((suggestion) => keywordKey(suggestion) === keywordKey(normalizedDraft));

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedSearch]);

  const addKeywords = (incoming: string[]) => {
    const cleaned = incoming.map(cleanKeyword).filter(Boolean);
    const invalid = cleaned.find((keyword) => keyword.length > MAX_KEYWORD_LENGTH);
    if (invalid) {
      setFeedback(`Cada palabra clave puede tener hasta ${MAX_KEYWORD_LENGTH} caracteres.`);
      return;
    }

    const current = uniqueKeywords(value);
    const currentKeys = new Set(current.map(keywordKey));
    const newKeywords = cleaned.filter((keyword, index, all) => {
      const key = keywordKey(keyword);
      return !currentKeys.has(key) && all.findIndex((item) => keywordKey(item) === key) === index;
    });
    if (current.length + newKeywords.length > MAX_KEYWORDS) {
      setFeedback(`Puedes agregar hasta ${MAX_KEYWORDS} palabras clave.`);
      return;
    }

    setFeedback("");
    onChange(uniqueKeywords([...current, ...newKeywords]));
    setDraft("");
  };

  const commitDraft = () => {
    const parts = draft.split(",").map(cleanKeyword).filter(Boolean);
    if (parts.length === 0) {
      if (visibleSuggestions[activeIndex]) addKeywords([visibleSuggestions[activeIndex]]);
      return;
    }

    if (parts.length === 1 && exactSuggestion) addKeywords([exactSuggestion]);
    else addKeywords(parts);
  };

  const handleInputChange = (nextValue: string) => {
    setFeedback("");
    if (!nextValue.includes(",")) {
      setDraft(nextValue);
      return;
    }

    const parts = nextValue.split(",");
    const trailing = parts.pop() ?? "";
    addKeywords(parts);
    setDraft(trailing);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === ",") {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(visibleSuggestions.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
  };

  const removeKeyword = (keyword: string) => {
    onChange(value.filter((current) => keywordKey(current) !== keywordKey(keyword)));
    setFeedback("");
  };

  const toggleSuggestion = (suggestion: string) => {
    if (selectedKeys.has(keywordKey(suggestion))) removeKeyword(suggestion);
    else addKeywords([suggestion]);
    setOpen(true);
    inputRef.current?.focus();
  };

  const canCreateDraft = normalizedDraft.length > 0 && !exactSuggestion;

  return (
    <div ref={rootRef} className="relative space-y-2">
      <div
        className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((keyword) => (
          <span
            key={`${keywordKey(keyword)}-${keyword}`}
            className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.07] px-2.5 text-xs font-medium text-primary"
          >
            <span className="truncate">{keyword}</span>
            <button
              type="button"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
              onClick={(event) => {
                event.stopPropagation();
                removeKeyword(keyword);
              }}
              aria-label={`Eliminar palabra clave ${keyword}`}
              disabled={disabled}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? (value.length ? "Agregar otra palabra..." : "Escribe una palabra clave...")}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={`${id}-suggestions`}
          aria-expanded={open}
          className="min-w-[12rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
          onClick={() => {
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
          aria-label={open ? "Ocultar palabras clave disponibles" : "Mostrar palabras clave disponibles"}
          aria-controls={`${id}-suggestions`}
          aria-expanded={open}
          disabled={disabled}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Presiona Enter para agregar · Puedes reutilizar palabras existentes.</span>
        <span className="shrink-0 tabular-nums">{value.length}/{MAX_KEYWORDS}</span>
      </div>

      {feedback && <p className="text-xs font-medium text-destructive" role="alert">{feedback}</p>}
      {error && <p className="text-xs text-amber-700">No se pudieron cargar las sugerencias; puedes escribirlas manualmente.</p>}

      {open && (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          aria-label="Palabras clave disponibles"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando palabras existentes...
            </div>
          ) : (
            <>
              {canCreateDraft && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/[0.07] focus-visible:bg-primary/[0.07] focus-visible:outline-none"
                  onClick={() => commitDraft()}
                >
                  <Plus className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="min-w-0 truncate">Agregar “{normalizedDraft}”</span>
                </button>
              )}

              {visibleSuggestions.map((suggestion, index) => {
                const selected = selectedKeys.has(keywordKey(suggestion));
                return (
                  <div
                    role="option"
                    aria-selected={selected}
                    key={`${keywordKey(suggestion)}-${suggestion}`}
                    className={`flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-left text-sm transition-colors ${index === activeIndex ? "bg-primary/[0.07]" : "hover:bg-muted/70"}`}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      onClick={() => toggleSuggestion(suggestion)}
                    >
                      <span className="min-w-0 truncate">{suggestion}</span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                    {onDeleteSuggestion && (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => onDeleteSuggestion(suggestion)}
                        aria-label={`Eliminar palabra clave ${suggestion}`}
                        disabled={disabled || Boolean(deletingKeyword)}
                        aria-busy={deletingKeyword === suggestion}
                      >
                        {deletingKeyword === suggestion ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}

              {!canCreateDraft && visibleSuggestions.length === 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  {suggestions.length ? "No hay coincidencias. Escribe otra palabra." : "Aún no hay palabras guardadas."}
                </p>
              )}
              {visibleSuggestions.length === MAX_VISIBLE_SUGGESTIONS && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Escribe para filtrar la lista.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
