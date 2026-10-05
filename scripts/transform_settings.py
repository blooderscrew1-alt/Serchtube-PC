import re
import sys

def main():
    with open('src/components/SettingsModal.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add ChevronDown, ChevronUp imports if not present
    if 'ChevronDown' not in content:
        content = content.replace(
            'import {\n  X,',
            'import {\n  ChevronDown,\n  ChevronUp,\n  X,'
        )

    # 2. Add CollapsibleSection component before SettingsModalComponent
    collapsible_comp = """interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  badge?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  gradient?: string;
  borderColor?: string;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  icon,
  summary,
  badge,
  isExpanded,
  onToggle,
  gradient = "bg-white/5",
  borderColor = "border-white/10",
  children
}) => {
  return (
    <div
      className={`rounded-2xl transition-all duration-200 border overflow-hidden ${
        isExpanded
          ? `${gradient} ${borderColor} shadow-xl ring-1 ring-white/10`
          : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 hover:border-white/20'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors cursor-pointer group select-none"
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
              isExpanded
                ? 'bg-red-600/20 text-red-400 border border-red-500/40 shadow-[0_0_12px_rgba(220,38,38,0.25)]'
                : 'bg-white/5 text-gray-400 border border-white/10 group-hover:text-white group-hover:bg-white/10'
            }`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                {title}
              </span>
              {badge}
            </div>
            <p className="text-[11px] text-gray-400 line-clamp-1 sm:line-clamp-2 mt-0.5 leading-snug font-normal">
              {summary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-gray-400 uppercase hidden sm:inline-block">
            {isExpanded ? 'Contraer' : 'Expandir'}
          </span>
          <div
            className={`p-1.5 rounded-lg text-gray-400 group-hover:text-white transition-all transform duration-200 ${
              isExpanded ? 'rotate-180 text-white bg-white/15' : 'rotate-0 bg-white/5'
            }`}
          >
            <ChevronDown size={15} />
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 pt-2 border-t border-white/10 space-y-4 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
};
"""

    if 'const CollapsibleSection:' not in content:
        content = content.replace(
            'const SettingsModalComponent: React.FC<SettingsModalProps> = ({',
            collapsible_comp + '\nconst SettingsModalComponent: React.FC<SettingsModalProps> = ({'
        )

    # 3. Add state inside SettingsModalComponent
    state_code = """  // Expandable / collapsible sections state (normally collapsed by default to save screen space)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const expandAllSections = () => {
    setExpandedSections({
      video_quality: true,
      video_opacity: true,
      auto_shutdown: true,
      audio_input: true,
      wake_word: true,
      tts_voice: true,
      voice_personality: true,
      audio_ducking: true,
      satellite_mic_only: true,
      equalizer: true,
      auto_volume: true,
      screensaver: true,
      visual_effects: true,
      media_compatibility: true
    });
  };

  const collapseAllSections = () => {
    setExpandedSections({});
  };
"""

    if 'expandedSections' not in content:
        content = content.replace(
            "  const [testingVoice, setTestingVoice] = useState<VoicePersonality | 'custom_browser' | null>(null);",
            state_code + "\n  const [testingVoice, setTestingVoice] = useState<VoicePersonality | 'custom_browser' | null>(null);"
        )

    # 4. Header buttons: Contraer todo / Expandir todo
    header_old = """        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center border border-red-600/20">
              <Settings2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight uppercase">Ajustes del Sistema</h2>
              <p className="text-xs text-gray-400">Voces neurales, video de fondo y protector de pantalla</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>"""

    header_new = """        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600/10 text-red-500 flex items-center justify-center border border-red-500/30 shadow-md">
              <Settings2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight uppercase">Ajustes del Sistema</h2>
              <p className="text-xs text-gray-400">Pestañas contraíbles para ahorrar espacio • Clic para expandir cada sección</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={Object.values(expandedSections).some(Boolean) ? collapseAllSections : expandAllSections}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title={Object.values(expandedSections).some(Boolean) ? "Contraer todas las herramientas" : "Expandir todas las herramientas"}
            >
              {Object.values(expandedSections).some(Boolean) ? (
                <>
                  <ChevronUp size={13} className="text-amber-400" />
                  <span>Contraer todo</span>
                </>
              ) : (
                <>
                  <ChevronDown size={13} className="text-red-400" />
                  <span>Expandir todo</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>"""

    if header_old in content:
        content = content.replace(header_old, header_new)

    with open('src/components/SettingsModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Header, state and CollapsibleSection added successfully')

if __name__ == '__main__':
    main()
