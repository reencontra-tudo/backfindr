'use client';

import { useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { getCategoryFieldConfig, FieldDefinition } from '@/config/categoryFields';

interface DynamicCategoryFieldsProps {
  category: string;
  values: Record<string, unknown>;
  onChange: (fieldName: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export function DynamicCategoryFields({
  category,
  values,
  onChange,
  errors = {},
}: DynamicCategoryFieldsProps) {
  const config = getCategoryFieldConfig(category);
  const [showOptional, setShowOptional] = useState(false);

  if (!config) return null;

  const renderField = (field: FieldDefinition, isOptional: boolean = false) => {
    const value = values[field.name] ?? '';
    const error = errors[field.name];

    return (
      <div key={field.name} className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-300">
          {field.label}
          {field.required && !isOptional && <span className="text-red-400 ml-1">*</span>}
        </label>

        {field.type === 'select' && (
          <select
            value={String(value)}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-brand-500 transition-colors ${
              error ? 'border-red-500' : 'border-surface-border'
            }`}
          >
            <option value="">Selecione {field.label.toLowerCase()}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {field.type === 'text' && (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors ${
              error ? 'border-red-500' : 'border-surface-border'
            }`}
          />
        )}

        {field.type === 'number' && (
          <input
            type="number"
            value={String(value)}
            onChange={(e) => onChange(field.name, e.target.value ? parseInt(e.target.value) : '')}
            placeholder={field.placeholder}
            className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors ${
              error ? 'border-red-500' : 'border-surface-border'
            }`}
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            value={String(value)}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors resize-none ${
              error ? 'border-red-500' : 'border-surface-border'
            }`}
          />
        )}

        {field.type === 'color' && (
          <div className="flex gap-2">
            <input
              type="color"
              value={String(value) || '#000000'}
              onChange={(e) => onChange(field.name, e.target.value)}
              className="w-16 h-11 rounded-lg cursor-pointer border border-surface-border"
            />
            <input
              type="text"
              value={String(value)}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder="#000000"
              className={`flex-1 bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors ${
                error ? 'border-red-500' : 'border-surface-border'
              }`}
            />
          </div>
        )}

        {field.hint && !error && (
          <p className="text-xs text-slate-500">{field.hint}</p>
        )}

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Campos Essenciais */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-brand-500 rounded-full" />
          <h3 className="font-semibold text-white text-sm">Informações Principais</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {config.essentialFields.map((field) => renderField(field, false))}
        </div>
      </div>

      {/* Campos Opcionais */}
      {config.optionalFields.length > 0 && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showOptional ? (
              <>
                <X className="w-4 h-4" />
                Ocultar detalhes adicionais
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Adicionar detalhes adicionais
              </>
            )}
          </button>

          {showOptional && (
            <div className="bg-slate-900/30 border border-slate-700/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-slate-600 rounded-full" />
                <p className="text-xs text-slate-400 font-medium">INFORMAÇÕES ADICIONAIS</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {config.optionalFields.map((field) => renderField(field, true))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
