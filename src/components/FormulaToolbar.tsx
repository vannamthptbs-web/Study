import React, { useState } from 'react';
import { Calculator, BookOpen, ChevronDown, ChevronUp, Atom, FlaskConical, Dna } from 'lucide-react';
import { QUICK_SYMBOLS_BY_CATEGORY } from '../utils/mathUtils';
import { FormulaReferenceModal } from './FormulaReferenceModal';

interface Props {
  onInsertSymbol: (symbol: string) => void;
  className?: string;
  compact?: boolean;
}

export const FormulaToolbar: React.FC<Props> = ({
  onInsertSymbol,
  className = '',
  compact = false,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [selectedCategory, setSelectedCategory] = useState<string>('Toán học');

  const categories = Object.keys(QUICK_SYMBOLS_BY_CATEGORY);
  const currentSymbols = QUICK_SYMBOLS_BY_CATEGORY[selectedCategory] || QUICK_SYMBOLS_BY_CATEGORY['Toán học'];

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Calculator className="w-3.5 h-3.5 text-indigo-600" />
          <span>Ký hiệu & Công thức chuẩn hóa (Toán & KHTN):</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
          >
            <BookOpen className="w-3 h-3" />
            <span>Cẩm nang công thức Toán & KHTN</span>
          </button>

          {compact && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              title={expanded ? 'Thu gọn thanh ký hiệu' : 'Mở rộng thanh ký hiệu'}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-1.5 bg-slate-50/70 p-2 rounded-xl border border-slate-200/70">
          {/* Sub-category selector */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin text-[11px]">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Symbols row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 scrollbar-thin text-xs">
            {currentSymbols.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onInsertSymbol(item.insert)}
                title={item.title}
                className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-800 font-mono text-xs border border-slate-200 transition-all whitespace-nowrap shrink-0 active:scale-95 shadow-2xs font-semibold"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal Cẩm nang công thức */}
      <FormulaReferenceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onInsertFormula={(formula) => onInsertSymbol(formula)}
      />
    </div>
  );
};
