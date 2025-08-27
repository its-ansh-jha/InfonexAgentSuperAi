import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface MathDisplayProps {
  math: string;
  isBlock?: boolean;
}

export function MathDisplay({ math, isBlock = false }: MathDisplayProps) {
  // Fix escaped backslashes and common math issues
  let fixedMath = math
    .replace(/\\\\([^\\])/g, '\\$1')  // Fix double backslashes
    .replace(/\\\$/g, '$')           // Fix escaped dollar signs
    .trim();
  
  // Remove surrounding whitespace and newlines for block math
  if (isBlock) {
    fixedMath = fixedMath.replace(/^\s+|\s+$/g, '');
  }
  
  try {
    return isBlock ? (
      <div className="math-block">
        <BlockMath math={fixedMath} />
      </div>
    ) : (
      <span className="math-inline">
        <InlineMath math={fixedMath} />
      </span>
    );
  } catch (error) {
    console.error('Error rendering math:', error);
    return (
      <span className="text-red-500 bg-red-950 px-2 py-1 rounded text-sm">
        Math Error: {math}
      </span>
    );
  }
}