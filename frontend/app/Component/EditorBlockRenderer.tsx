import React from 'react';
import CustomImage from "@/Component1/CustomImage";

export type IBlock = {
  id?: string;
  type: string;
  data: Record<string, any>;
};

interface EditorBlockRendererProps {
  blocks?: IBlock[];
}

export const EditorBlockRenderer: React.FC<EditorBlockRendererProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="editor-content space-y-6">
      {blocks.map((block, index) => {
        const key = block.id || `block-${index}`;

        switch (block.type) {
          case 'header': {
            const level = block.data.level as number;
            const HeaderTag = `h${level}` as keyof JSX.IntrinsicElements;
            
            // Adjust styles for headers since h1 is usually reserved for the page title
            const headerClasses = {
              1: 'text-3xl font-bold mt-8 mb-4 text-gray-900',
              2: 'text-2xl font-bold mt-8 mb-4 text-gray-900',
              3: 'text-xl font-bold mt-6 mb-3 text-gray-900',
              4: 'text-lg font-bold mt-4 mb-2 text-gray-900',
              5: 'text-base font-bold mt-4 mb-2 text-gray-900',
              6: 'text-sm font-bold mt-4 mb-2 text-gray-900',
            }[level] || 'font-bold mt-4 mb-2 text-gray-900';

            return (
              <HeaderTag
                key={key}
                className={headerClasses}
                dangerouslySetInnerHTML={{ __html: block.data.text }}
              />
            );
          }

          case 'paragraph':
            return (
              <p
                key={key}
                className="text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: block.data.text }}
              />
            );

          case 'list': {
            const style = block.data.style; // unordered, ordered, checklist
            const items = block.data.items || [];
            
            return <ListBlock key={key} style={style} items={items} />;
          }

          case 'quote':
            return (
              <blockquote
                key={key}
                className={`border-l-4 border-gray-300 pl-4 py-2 italic text-gray-600 my-6 bg-gray-50 rounded-r text-${block.data.alignment || 'left'}`}
              >
                <div dangerouslySetInnerHTML={{ __html: block.data.text }} />
                {block.data.caption && (
                  <footer className="text-sm mt-2 text-gray-500 font-medium" dangerouslySetInnerHTML={{ __html: block.data.caption }} />
                )}
              </blockquote>
            );

          case 'table': {
            const withHeadings = block.data.withHeadings;
            const content = block.data.content as string[][];
            
            if (!content || content.length === 0) return null;

            const headings = withHeadings ? content[0] : null;
            const rows = withHeadings ? content.slice(1) : content;

            return (
              <div key={key} className="overflow-x-auto my-6">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  {headings && (
                    <thead className="bg-gray-50">
                      <tr>
                        {headings.map((cell, i) => (
                          <th
                            key={i}
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                            dangerouslySetInnerHTML={{ __html: cell }}
                          />
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                            dangerouslySetInnerHTML={{ __html: cell }}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case 'code':
            return (
              <pre key={key} className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-6 text-sm font-mono">
                <code>{block.data.code}</code>
              </pre>
            );

          case 'image': {
            const imgUrl = block.data.file?.url;
            if (!imgUrl) return null;
            
            const isExternal = imgUrl.startsWith('http');
            const finalUrl = isExternal ? imgUrl : `${process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL}${imgUrl}`;

            return (
              <figure key={key} className={`my-8 flex flex-col items-center ${block.data.withBackground ? 'bg-gray-100 p-4' : ''}`}>
                <CustomImage
                  src={finalUrl}
                  alt={block.data.caption || 'Image'}
                  className={`max-w-full h-auto rounded-lg ${block.data.withBorder ? 'border border-gray-300' : ''} ${block.data.stretched ? 'w-full' : ''}`}
                />
                {block.data.caption && (
                  <figcaption className="text-center text-sm text-gray-500 mt-2" dangerouslySetInnerHTML={{ __html: block.data.caption }} />
                )}
              </figure>
            );
          }

          case 'embed': {
            if (block.data.service === 'youtube' || block.data.service === 'vimeo') {
              return (
                <div key={key} className="my-8 flex flex-col items-center w-full">
                  <div className="relative w-full overflow-hidden" style={{ paddingTop: '56.25%' }}>
                    <iframe
                      src={block.data.embed}
                      className="absolute top-0 left-0 w-full h-full rounded-lg"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                  {block.data.caption && (
                    <div className="text-center text-sm text-gray-500 mt-2" dangerouslySetInnerHTML={{ __html: block.data.caption }} />
                  )}
                </div>
              );
            }
            return null;
          }

          default:
            console.warn(`Unknown block type: ${block.type}`);
            return null;
        }
      })}
    </div>
  );
};

// Recursive list block rendering
const ListBlock = ({ style, items }: { style: string; items: any[] }) => {
  if (!items || items.length === 0) return null;

  const Tag = style === 'ordered' ? 'ol' : 'ul';
  const listClass = style === 'ordered' 
    ? 'list-decimal list-outside pl-6 space-y-2' 
    : style === 'checklist' 
      ? 'space-y-2' 
      : 'list-disc list-outside pl-6 space-y-2';

  return (
    <Tag className={listClass}>
      {items.map((item, index) => (
        <li key={index} className="text-gray-700 flex items-start group">
          {style === 'checklist' && (
            <div className="flex-shrink-0 mt-1 mr-3">
              <input 
                type="checkbox" 
                readOnly 
                checked={item.meta?.checked || false} 
                className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
              />
            </div>
          )}
          <div className={style === 'checklist' ? 'flex-1' : ''}>
            <span dangerouslySetInnerHTML={{ __html: item.content }} />
            {item.items && item.items.length > 0 && (
              <div className="mt-2">
                <ListBlock style={style} items={item.items} />
              </div>
            )}
          </div>
        </li>
      ))}
    </Tag>
  );
};
