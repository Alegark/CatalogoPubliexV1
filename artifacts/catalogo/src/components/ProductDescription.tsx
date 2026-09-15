import { useMemo } from 'react';

type DescriptionBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; lines: string[] };

const BULLET_PREFIX = /^(?:\u{1F539}|\u2022|-|\*)\s*/u;

function getDescriptionBlocks(description: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let paragraphLines: string[] = [];
  let listLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraphLines });
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listLines.length > 0) {
      blocks.push({ type: 'list', lines: listLines });
      listLines = [];
    }
  };

  for (const rawLine of description.replace(/\r\n?/gu, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletText = line.replace(BULLET_PREFIX, '');
    if (bulletText !== line) {
      flushParagraph();
      listLines.push(bulletText);
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}

function DescriptionContent({ description }: { description: string }) {
  const blocks = useMemo(() => getDescriptionBlocks(description), [description]);

  return (
    <div className="space-y-4 text-sm leading-7 text-gray-600">
      {blocks.map((block, index) => block.type === 'list' ? (
        <ul key={`description-list-${index}`} className="list-disc space-y-1 pl-5 marker:text-primary">
          {block.lines.map((line, lineIndex) => <li key={`description-item-${index}-${lineIndex}`}>{line}</li>)}
        </ul>
      ) : (
        <p key={`description-paragraph-${index}`} className="whitespace-pre-line">
          {block.lines.join('\n')}
        </p>
      ))}
    </div>
  );
}

export function ProductDescription({ description }: { description?: string | null }) {
  const normalizedDescription = description?.trim() ?? '';

  if (!normalizedDescription) return null;

  return (
    <section className="border-t border-gray-100 px-6 py-7 md:px-10" aria-labelledby="product-description-title">
      <div className="flex items-center gap-4">
        <h2 id="product-description-title" className="text-xl font-bold text-gray-900">{'Descripci\u00f3n'}</h2>
      </div>
      <div id="product-description-content" className="mt-4 product-description-body">
        <DescriptionContent description={normalizedDescription} />
      </div>
    </section>
  );
}
