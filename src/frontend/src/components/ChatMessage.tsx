import React, { useState } from 'react';
import { Message } from '../hooks/useChat';
import ReactMarkdown from 'react-markdown';
import { useCommandExplain } from '../contexts/CommandExplainContext';
import { extractFirstCommandLine, isCmdletToken } from '../utils/powershellCommandUtils';

interface ChatMessageProps {
  message: Message;
  onSaveScript?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSaveScript }) => {
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const { openCommand } = useCommandExplain();

  // Function to check if the message contains code blocks
  const hasCodeBlock = (content: string): boolean => {
    return content.includes('```');
  };

  // Function to copy code to clipboard
  const copyCodeToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy code: ', err);
    });
  };

  // Extract PowerShell code blocks from message (kept for future use)
  const _extractCodeBlocks = (content: string): string[] => {
    const regex = /```(?:powershell)?\n([\s\S]*?)```/g;
    const matches = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  };

  // Render code blocks with syntax highlighting and copy button
  const renderCodeBlock = (props: any) => {
    const { children, className, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const isPs = !language || language === 'powershell';
    const codeText = String(children || '');

    return (
      <div className="relative rounded-md overflow-hidden bg-[var(--color-bg-tertiary)]">
        <div className="flex justify-between items-center px-4 py-2 text-xs border-b border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
          <span className="text-[var(--color-text-secondary)]">{isPs ? 'PowerShell' : language}</span>
          <div className="flex space-x-2">
            {showCopySuccess && (
              <span className="text-xs text-emerald-500">
                Copied!
              </span>
            )}
            <button
              onClick={() => copyCodeToClipboard(codeText)}
              className="px-2 py-1 rounded text-xs bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-secondary)] transition-colors"
            >
              Copy
            </button>
            {isPs && (
              <button
                type="button"
                onClick={() => openCommand(extractFirstCommandLine(codeText) || codeText, 'chat')}
                className="px-2 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Explain
              </button>
            )}
            {onSaveScript && isPs && (
              <button
                onClick={onSaveScript}
                className="px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Save as Script
              </button>
            )}
          </div>
        </div>
        <pre className={`p-4 overflow-x-auto text-[var(--color-text-primary)] ${className}`} {...rest}>
          {codeText}
        </pre>
      </div>
    );
  };

  // Custom components for ReactMarkdown
  const components = {
    code({ inline, className, children, ...props }: any) {
      if (inline) {
        const text = String(children || '').trim();
        if (isCmdletToken(text)) {
          return (
            <button
              type="button"
              onClick={() => openCommand(text, 'chat')}
              className="bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] px-1 py-0.5 rounded text-sm font-mono cursor-pointer hover:bg-[var(--color-bg-tertiary)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Explain command"
            >
              {text}
            </button>
          );
        }
        return (
          <code
            className="bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] px-1 py-0.5 rounded text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }

      return renderCodeBlock({
        children: String(children).replace(/\n$/, ''),
        className,
        ...props
      });
    },
    p({ children }: any) {
      return <p className="mb-4 last:mb-0">{children}</p>;
    },
    h1({ children }: any) {
      return <h1 className="text-2xl font-bold mb-4">{children}</h1>;
    },
    h2({ children }: any) {
      return <h2 className="text-xl font-bold mb-3">{children}</h2>;
    },
    h3({ children }: any) {
      return <h3 className="text-lg font-bold mb-2">{children}</h3>;
    },
    ul({ children }: any) {
      return <ul className="list-disc pl-6 mb-4">{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="list-decimal pl-6 mb-4">{children}</ol>;
    },
    li({ children }: any) {
      return <li className="mb-1">{children}</li>;
    },
    a({ href, children }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-400 hover:underline"
        >
          {children}
        </a>
      );
    },
    blockquote({ children }: any) {
      return (
        <blockquote
          className="border-l-4 border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] pl-4 py-2 mb-4 italic"
        >
          {children}
        </blockquote>
      );
    },
    table({ children }: any) {
      return (
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full border border-[var(--color-border-default)]">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }: any) {
      return (
        <thead className="bg-[var(--color-bg-tertiary)]">
          {children}
        </thead>
      );
    },
    tbody({ children }: any) {
      return <tbody>{children}</tbody>;
    },
    tr({ children }: any) {
      return (
        <tr className="border-t border-[var(--color-border-default)]">
          {children}
        </tr>
      );
    },
    th({ children }: any) {
      return (
        <th className="border border-[var(--color-border-default)] px-4 py-2 text-left font-semibold">
          {children}
        </th>
      );
    },
    td({ children }: any) {
      return (
        <td className="border border-[var(--color-border-default)] px-4 py-2">
          {children}
        </td>
      );
    },
    hr() {
      return (
        <hr className="my-4 border-[var(--color-border-default)]" />
      );
    }
  };

  return (
    <div className={`mb-4 ${message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
      <div
        className={`max-w-3xl rounded-lg p-3 ${
          message.role === 'user'
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)]'
        }`}
      >
        {message.role === 'user' ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown components={components}>
              {message.content}
            </ReactMarkdown>

            {hasCodeBlock(message.content) && onSaveScript && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={onSaveScript}
                  className="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Save as Script
                </button>
              </div>
            )}
          </div>
        )}

        {message.timestamp && (
          <div className={`text-xs mt-2 text-right ${
            message.role === 'user'
              ? 'text-white/70'
              : 'text-[var(--color-text-tertiary)]'
          }`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
