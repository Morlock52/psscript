/**
 * SafeHtml Component
 *
 * A secure React component for rendering HTML content.
 * Automatically sanitizes HTML using DOMPurify to prevent XSS attacks.
 *
 * ALWAYS use this component instead of dangerouslySetInnerHTML directly.
 *
 * @example
 * // Basic usage
 * <SafeHtml html={userContent} />
 *
 * @example
 * // With markdown content
 * <SafeHtml html={markedHtml} variant="markdown" />
 *
 * @example
 * // Strict mode for user comments
 * <SafeHtml html={comment} variant="strict" />
 */
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

// Sanitization configurations (mutable for DOMPurify compatibility)
const CONFIGS = {
  default: {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'ul', 'ol', 'li',
      'a', 'img',
      'pre', 'code', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'src', 'alt', 'title', 'width', 'height',
      'class', 'id',
      'colspan', 'rowspan',
    ],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  },
  markdown: {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins',
      'ul', 'ol', 'li',
      'a', 'img',
      'pre', 'code', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
      'sup', 'sub', 'mark',
      'dl', 'dt', 'dd',
      'figure', 'figcaption',
      'abbr', 'cite', 'dfn', 'kbd', 'samp', 'var',
      'details', 'summary',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel',
      'src', 'alt', 'title', 'width', 'height',
      'class', 'id',
      'colspan', 'rowspan',
      'open', 'lang',
    ],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  },
  strict: {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre'],
    ALLOWED_ATTR: ['class'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'a', 'img'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'href', 'src'],
  },
};

type SanitizeVariant = 'default' | 'markdown' | 'strict';

interface SafeHtmlProps {
  /**
   * The HTML string to sanitize and render
   */
  html: string;
  /**
   * Sanitization variant:
   * - 'default': Standard sanitization allowing common HTML
   * - 'markdown': Extended tags for markdown-generated HTML
   * - 'strict': Minimal tags, no links or images
   */
  variant?: SanitizeVariant;
  /**
   * HTML element type to render (default: 'div')
   */
  as?: keyof JSX.IntrinsicElements;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Additional inline styles
   */
  style?: React.CSSProperties;
}

/**
 * SafeHtml - Secure HTML rendering component
 *
 * This component MUST be used instead of dangerouslySetInnerHTML
 * to ensure XSS protection across the application.
 */
const SafeHtml: React.FC<SafeHtmlProps> = ({
  html,
  variant = 'default',
  as: Component = 'div',
  className,
  style,
}) => {
  // Memoize sanitization to avoid re-processing on every render
  const sanitizedHtml = useMemo(() => {
    if (!html) return '';

    const config = CONFIGS[variant];
    return DOMPurify.sanitize(html, config);
  }, [html, variant]);

  return (
    <Component
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

/**
 * Hook for sanitizing HTML in functional components
 *
 * @example
 * const MyComponent = ({ content }) => {
 *   const safeHtml = useSafeHtml(content, 'markdown');
 *   return <div dangerouslySetInnerHTML={safeHtml} />;
 * };
 */
export function useSafeHtml(
  html: string,
  variant: SanitizeVariant = 'default'
): { __html: string } {
  return useMemo(() => {
    if (!html) return { __html: '' };
    const config = CONFIGS[variant];
    return { __html: DOMPurify.sanitize(html, config) };
  }, [html, variant]);
}

export default SafeHtml;
