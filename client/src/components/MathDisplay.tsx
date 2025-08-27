import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface MathDisplayProps {
  math: string;
  isBlock?: boolean;
}

export function MathDisplay({ math, isBlock = false }: MathDisplayProps) {
  // Fix escaped backslashes that come from the API
  const fixedMath = math.replace(/\\\\([^\\])/g, '\\$1');
  
  try {
    return isBlock ? (
      <BlockMath math={fixedMath} />
    ) : (
      <InlineMath math={fixedMath} />
    );
  } catch (error) {
    console.error('Error rendering math:', error);
    return <span className="text-red-500">Error rendering math: {math}</span>;
  }
}