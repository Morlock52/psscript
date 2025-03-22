/**
 * Service for chunking text content into smaller pieces for embedding
 */
class ChunkingService {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1000;
    this.chunkOverlap = options.chunkOverlap || 200;
    this.separator = options.separator || '\n';
    this.markdownHeadingPattern = options.markdownHeadingPattern || /^(#{1,6} .+)$/gm;
    this.useTopicBasedChunking = options.useTopicBasedChunking || true;
  }

  /**
   * Split text into chunks with overlap
   * @param {string} text - Text to chunk
   * @returns {string[]} - Array of text chunks
   */
  chunkText(text) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Split text by separator
    const segments = text.split(this.separator);
    const chunks = [];
    let currentChunk = [];
    let currentChunkLength = 0;

    for (const segment of segments) {
      // Skip empty segments
      if (segment.trim().length === 0) {
        continue;
      }

      // If adding this segment would exceed chunk size, save current chunk and start a new one
      if (currentChunkLength + segment.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(this.separator));

        // Keep some overlap from the previous chunk
        const overlapSegments = [];
        let overlapLength = 0;

        for (let i = currentChunk.length - 1; i >= 0; i--) {
          if (overlapLength + currentChunk[i].length <= this.chunkOverlap) {
            overlapSegments.unshift(currentChunk[i]);
            overlapLength += currentChunk[i].length;
          } else {
            break;
          }
        }

        currentChunk = [...overlapSegments];
        currentChunkLength = overlapLength;
      }

      // Add segment to current chunk
      currentChunk.push(segment);
      currentChunkLength += segment.length;
    }

    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(this.separator));
    }

    return chunks;
  }

  /**
   * Split markdown text into chunks trying to preserve structure
   * @param {string} markdown - Markdown text to chunk
   * @returns {string[]} - Array of markdown chunks
   */
  chunkMarkdown(markdown) {
    if (!markdown || markdown.trim().length === 0) {
      return [];
    }

    if (this.useTopicBasedChunking) {
      return this.chunkMarkdownByTopic(markdown);
    } else {
      return this.chunkMarkdownByHeadings(markdown);
    }
  }

  /**
   * Split markdown by headings to preserve document structure
   * @param {string} markdown - Markdown text to chunk
   * @returns {string[]} - Array of markdown chunks
   */
  chunkMarkdownByHeadings(markdown) {
    // For markdown we'll try to split at headers first
    const sections = [];
    let lastIndex = 0;
    let match;

    // Find all headers and split text into sections
    while ((match = this.markdownHeadingPattern.exec(markdown)) !== null) {
      if (match.index > lastIndex) {
        sections.push(markdown.substring(lastIndex, match.index));
      }
      lastIndex = match.index;
    }

    // Add the last section
    if (lastIndex < markdown.length) {
      sections.push(markdown.substring(lastIndex));
    }

    // Now chunk each section
    const chunks = [];
    for (const section of sections) {
      const sectionChunks = this.chunkText(section);
      chunks.push(...sectionChunks);
    }

    return chunks;
  }

  /**
   * Split markdown using topic-based chunking for better semantic coherence
   * @param {string} markdown - Markdown text to chunk
   * @returns {string[]} - Array of markdown chunks
   */
  chunkMarkdownByTopic(markdown) {
    // First, identify all headings and their positions
    const headings = [];
    let match;
    const headingRegex = /^(#{1,6} .+)$/gm;
    
    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].indexOf(' '); // Count # symbols to determine heading level
      headings.push({
        text: match[1],
        position: match.index,
        level: level
      });
    }
    
    // Add end of document as a marker
    headings.push({
      text: '',
      position: markdown.length,
      level: 0
    });
    
    // Create sections based on heading hierarchy
    const sections = [];
    for (let i = 0; i < headings.length - 1; i++) {
      const currentHeading = headings[i];
      const nextHeading = headings[i + 1];
      
      // Extract section content
      const sectionContent = markdown.substring(
        currentHeading.position,
        nextHeading.position
      );
      
      sections.push({
        heading: currentHeading.text,
        content: sectionContent,
        level: currentHeading.level
      });
    }
    
    // Process sections into chunks
    const chunks = [];
    
    // Helper function to add context to chunks
    const addContextToChunk = (chunk, context) => {
      if (context && context.trim()) {
        return `${context}\n\n${chunk}`;
      }
      return chunk;
    };
    
    // Process each section
    for (const section of sections) {
      // For very small sections, keep them as is
      if (section.content.length <= this.chunkSize) {
        chunks.push(section.content);
        continue;
      }
      
      // For larger sections, chunk them while preserving the heading as context
      const sectionChunks = this.chunkText(section.content);
      
      // Add the section heading as context to each chunk
      for (const chunk of sectionChunks) {
        chunks.push(addContextToChunk(chunk, section.heading));
      }
    }
    
    return chunks;
  }

  /**
   * Create chunks from a webpage's content
   * @param {Object} webpage - Webpage object with content and markdown
   * @returns {Object[]} - Array of chunk objects with content and metadata
   */
  createWebpageChunks(webpage) {
    // Prefer markdown for chunking as it preserves structure better
    const content = webpage.markdown || webpage.content;
    const isMarkdown = !!webpage.markdown;
    
    // Choose appropriate chunking method
    const chunks = isMarkdown 
      ? this.chunkMarkdown(content)
      : this.chunkText(content);

    return chunks.map((chunk, index) => ({
      content: chunk,
      chunkIndex: index,
      metadata: {
        url: webpage.url,
        title: webpage.title,
        chunkCount: chunks.length,
        isMarkdown: isMarkdown
      }
    }));
  }
}

module.exports = ChunkingService;
