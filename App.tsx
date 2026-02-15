
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  ClipboardList, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronRight, 
  Save, 
  FileText, 
  Copy, 
  X, 
  Check,
  Plus,
  LayoutDashboard,
  Search,
  Archive,
  Clock,
  Trash2,
  ChevronLeft,
  Lock,
  Cpu,
  History,
  AlertTriangle
} from 'lucide-react';
import { CaseData, InvestigationStep, Priority, CaseCategory } from './types';
import { generateInvestigationPlan, suggestNextSteps, generateDocumentDraft } from './services/gemini';

const STORAGE_KEY = 'gendarme_ai_cases';

const App: React.FC = () => {
  // State for all cases
  const [cases, setCases] = useState<CaseData[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // UI State
  const [view, setView] = useState<'dashboard' | 'editor' | 'roadmap'>('dashboard');
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [stepResult, setStepResult] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Manual Step Form State
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualLegal, setManualLegal] = useState('');
  const [manualPriority, setManualPriority] = useState<Priority>(Priority.NORMALE);

  // Form State
  const [infraction, setInfraction] = useState('');
  const [category, setCategory] = useState<CaseCategory>(CaseCategory.BIENS);
  const [modusOperandi, setModusOperandi] = useState('');

  // Draft Modal State
  const [currentDraft, setCurrentDraft] = useState<{title: string, content: string} | null>(null);
  const [copied, setCopied] = useState(false);

  // Persistence (LocalStorage)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  }, [cases]);

  const currentCase = useMemo(() => 
    cases.find(c => c.id === currentCaseId) || null
  , [cases, currentCaseId]);

  const handleError = (error: any) => {
    const msg = error?.message || "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      setErrorMessage("Quota API dépassé. L'intelligence artificielle est temporairement indisponible (limite de requêtes gratuites atteinte). Veuillez patienter quelques minutes.");
    } else {
      setErrorMessage("Une erreur technique est survenue lors de la communication avec l'IA.");
    }
    console.error(error);
    setTimeout(() => setErrorMessage(null), 8000);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infraction || !modusOperandi) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const steps = await generateInvestigationPlan(infraction, modusOperandi);
      const newCase: CaseData = {
        id: `case-${Date.now()}`,
        infraction,
        category,
        modusOperandi,
        steps,
        currentStatus: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setCases(prev => [newCase, ...prev]);
      setCurrentCaseId(newCase.id);
      setView('roadmap');
      setInfraction('');
      setModusOperandi('');
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCase = (updatedCase: CaseData) => {
    setCases(prev => prev.map(c => c.id === updatedCase.id ? { ...updatedCase, updatedAt: Date.now() } : c));
  };

  const handleManualAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase || !manualTitle) return;

    const newStep: InvestigationStep = {
      id: `step-manual-${Date.now()}`,
      title: manualTitle,
      description: manualDesc,
      legalBasis: manualLegal || "N.C.",
      priority: manualPriority,
      completed: false
    };

    updateCase({
      ...currentCase,
      steps: [...currentCase.steps, newStep]
    });

    setManualTitle('');
    setManualDesc('');
    setManualLegal('');
    setShowManualAdd(false);
  };

  const markStepComplete = (stepId: string, result: string) => {
    if (!currentCase) return;
    const updatedSteps = currentCase.steps.map(s => 
      s.id === stepId ? { ...s, completed: true, result } : s
    );
    updateCase({ ...currentCase, steps: updatedSteps });
    setEditingStep(null);
    setStepResult('');
  };

  const handleNextPhase = async () => {
    if (!currentCase) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const newSteps = await suggestNextSteps(currentCase.infraction, currentCase.steps);
      updateCase({
        ...currentCase,
        steps: [...currentCase.steps, ...newSteps]
      });
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDraft = async (step: InvestigationStep) => {
    if (!currentCase) return;
    setIsDrafting(true);
    setErrorMessage(null);
    try {
      const draft = await generateDocumentDraft(step, currentCase.infraction, currentCase.modusOperandi);
      setCurrentDraft({ title: step.title, content: draft });
    } catch (error) {
      handleError(error);
    } finally {
      setIsDrafting(false);
    }
  };

  const deleteCase = (id: string) => {
    if (confirm("Supprimer définitivement ce dossier stocké localement ?")) {
      setCases(prev => prev.filter(c => c.id !== id));
      if (currentCaseId === id) setView('dashboard');
    }
  };

  const archiveCase = (id: string) => {
    const targetCase = cases.find(c => c.id === id);
    if (targetCase) {
      updateCase({ ...targetCase, currentStatus: targetCase.currentStatus === 'completed' ? 'active' : 'completed' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#002654] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => setView('dashboard')}
          >
            <ShieldCheck className="w-8 h-8 text-blue-300" />
            <div className="leading-tight">
              <h1 className="text-lg font-bold tracking-tight">Gendarme-AI Investigator</h1>
              <div className="flex items-center gap-1.5 text-[10px] text-blue-300 font-bold uppercase tracking-wider">
                <Lock className="w-3 h-3" /> Stockage local chiffré
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-xs font-bold uppercase ${view === 'dashboard' ? 'bg-blue-800' : 'hover:bg-blue-800/50'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Dossiers</span>
            </button>
            <button 
              onClick={() => setView('editor')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-xs font-bold uppercase ${view === 'editor' ? 'bg-blue-800' : 'hover:bg-blue-800/50'}`}
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nouveau</span>
            </button>
          </div>
        </div>
      </header>

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 animate-slideDown">
          <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-red-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold text-sm">Erreur de service</p>
              <p className="text-xs opacity-90">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="ml-auto p-1 hover:bg-white/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Privacy Notice Banner */}
      <div className="bg-amber-50 border-b border-amber-100 py-2">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-2 text-[10px] text-amber-800 font-bold uppercase tracking-widest">
          <Cpu className="w-3 h-3" />
          Note : Les données sont stockées sur votre PC uniquement. L'IA est anonymisée automatiquement.
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        
        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-[#002654]">Archives Locales</h2>
                <p className="text-slate-500 font-medium">Gestionnaire sécurisé de vos enquêtes en cours.</p>
              </div>
              <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-2.5 flex-1 max-w-md">
                <Search className="w-5 h-5 text-slate-400 mr-2" />
                <input type="text" placeholder="Rechercher par infraction..." className="bg-transparent outline-none w-full text-sm" />
              </div>
            </div>

            {cases.length === 0 ? (
              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center space-y-6">
                <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-10 h-10 text-blue-900" />
                </div>
                <div className="max-w-sm mx-auto">
                  <h3 className="text-xl font-bold text-slate-800">Aucun dossier en mémoire</h3>
                  <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                    Vos données sont sauvegardées localement dans votre navigateur. Elles ne quittent jamais ce terminal.
                  </p>
                </div>
                <button 
                  onClick={() => setView('editor')}
                  className="bg-[#002654] text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-900 transition-all shadow-xl shadow-blue-100"
                >
                  Démarrer un dossier
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cases.map(c => {
                  const completedCount = c.steps.filter(s => s.completed).length;
                  const progress = Math.round((completedCount / (c.steps.length || 1)) * 100);
                  
                  return (
                    <div 
                      key={c.id}
                      onClick={() => { setCurrentCaseId(c.id); setView('roadmap'); }}
                      className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-2xl hover:border-blue-300 transition-all cursor-pointer overflow-hidden flex flex-col"
                    >
                      <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
                            {c.category}
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${c.currentStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-[#002654]'}`}>
                            {c.currentStatus === 'completed' ? 'Clôturé' : 'Actif'}
                          </span>
                        </div>
                        <h3 className="font-black text-[#002654] text-xl mb-2 line-clamp-1">
                          {c.infraction}
                        </h3>
                        <p className="text-slate-500 text-xs line-clamp-2 italic mb-6">
                          "{c.modusOperandi}"
                        </p>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <span>Avancement procédure</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-700 ${progress === 100 ? 'bg-emerald-500' : 'bg-[#002654]'}`} 
                              style={{ width: `${progress}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        <div className="flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" />
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); archiveCase(c.id); }}
                            className="p-2 hover:bg-white rounded-lg text-slate-500 border border-transparent hover:border-slate-200 transition-all"
                            title={c.currentStatus === 'completed' ? "Réactiver" : "Clôturer"}
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteCase(c.id); }}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-500 border border-transparent hover:border-red-100 transition-all"
                            title="Supprimer localement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW: NEW CASE FORM */}
        {view === 'editor' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            <button 
              onClick={() => setView('dashboard')}
              className="text-slate-500 hover:text-[#002654] flex items-center gap-2 text-xs font-black uppercase tracking-widest"
            >
              <ChevronLeft className="w-4 h-4" />
              Tableau de bord
            </button>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-[#002654]">Initialiser une Investigation</h2>
              <p className="text-slate-500 font-medium">Décrivez l'infraction pour générer une trame conforme.</p>
            </div>

            <form onSubmit={handleCreateCase} className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Classification</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CaseCategory)}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#002654] outline-none transition-all bg-slate-50 font-medium"
                  >
                    {Object.values(CaseCategory).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nature de l'Infraction</label>
                  <input 
                    type="text" 
                    value={infraction}
                    onChange={(e) => setInfraction(e.target.value)}
                    placeholder="Ex: Vols sériels, Escroquerie..."
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#002654] outline-none transition-all bg-slate-50 font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Détail du Mode Opératoire</label>
                <textarea 
                  value={modusOperandi}
                  onChange={(e) => setModusOperandi(e.target.value)}
                  placeholder="Expliquez comment l'auteur a procédé, outils, horaires, signalement..."
                  className="w-full h-48 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#002654] outline-none transition-all bg-slate-50 resize-none font-medium leading-relaxed"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#002654] hover:bg-blue-900 text-white font-black py-5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-50 shadow-2xl shadow-blue-200 text-sm uppercase tracking-widest"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyse & Trame OPJ...
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-5 h-5" />
                    Créer le dossier judiciaire
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* VIEW: ROADMAP (ACTIVE CASE) */}
        {view === 'roadmap' && currentCase && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
              <div className="space-y-3">
                <button 
                  onClick={() => setView('dashboard')}
                  className="text-slate-400 hover:text-[#002654] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Retour dossiers
                </button>
                <div className="flex items-center gap-3">
                   <span className="text-[10px] font-black bg-[#002654] text-white px-3 py-1 rounded-md uppercase tracking-wider">
                    {currentCase.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Ouvert le {new Date(currentCase.createdAt).toLocaleDateString()}</span>
                </div>
                <h2 className="text-4xl font-black text-[#002654] tracking-tight">{currentCase.infraction}</h2>
                <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-100 max-w-3xl">
                  <p className="text-slate-600 italic text-sm leading-relaxed">"{currentCase.modusOperandi}"</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowManualAdd(!showManualAdd)}
                  className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Acte manuel
                </button>
                <button 
                  onClick={handleNextPhase}
                  disabled={isLoading}
                  className="bg-[#002654] hover:bg-blue-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  Évaluer & Suite
                </button>
              </div>
            </div>

            {/* Manual Add Form */}
            {showManualAdd && (
              <div className="bg-white p-8 rounded-3xl border-2 border-blue-500 shadow-xl animate-slideDown space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-[#002654] uppercase tracking-wider">Ajouter un acte spécifique</h3>
                  <button onClick={() => setShowManualAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleManualAddStep} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titre de l'acte</label>
                    <input value={manualTitle} onChange={e => setManualTitle(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="Ex: Perquisition domiciliaire" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priorité</label>
                    <select value={manualPriority} onChange={e => setManualPriority(e.target.value as Priority)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium bg-slate-50">
                      {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                    <input value={manualDesc} onChange={e => setManualDesc(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium" placeholder="Détaillez la mission..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Légale</label>
                    <input value={manualLegal} onChange={e => setManualLegal(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium" placeholder="Ex: Art. 53, 76 ou 95 du CPP" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="submit" className="bg-[#002654] text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Ajouter à la feuille de route</button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid gap-6">
              {currentCase.steps.map((step, index) => (
                <div 
                  key={step.id} 
                  className={`bg-white rounded-3xl border-l-[6px] shadow-sm transition-all hover:shadow-xl ${
                    step.completed ? 'border-emerald-500 bg-emerald-50/10' : 
                    step.priority === Priority.URGENT ? 'border-red-500' : 
                    step.priority === Priority.HAUTE ? 'border-orange-500' : 'border-blue-700'
                  }`}
                >
                  <div className="p-8">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-md uppercase tracking-wider">
                            PROCÉDURE N°{index + 1}
                          </span>
                          <span className={`text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider ${
                            step.priority === Priority.URGENT ? 'bg-red-100 text-red-700' :
                            step.priority === Priority.HAUTE ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {step.priority}
                          </span>
                        </div>
                        <h3 className="text-2xl font-black text-[#002654] tracking-tight">{step.title}</h3>
                        <p className="text-slate-600 font-medium leading-relaxed max-w-4xl">{step.description}</p>
                        <div className="flex items-center gap-2 mt-4 text-[11px] text-blue-800 font-black bg-blue-50 w-fit px-4 py-1.5 rounded-lg uppercase tracking-widest">
                          <AlertCircle className="w-4 h-4" />
                          {step.legalBasis}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-3">
                        {step.completed ? (
                          <div className="flex items-center justify-center bg-emerald-100 text-emerald-600 p-4 rounded-2xl shadow-inner">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                        ) : (
                          <button 
                            onClick={() => setEditingStep(step.id)}
                            title="Saisir résultat"
                            className="bg-slate-50 hover:bg-[#002654] text-slate-600 hover:text-white p-4 rounded-2xl border border-slate-100 transition-all shadow-sm"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleGenerateDraft(step)}
                          disabled={isDrafting}
                          title="Rédiger le PV"
                          className="bg-slate-50 hover:bg-amber-600 text-slate-600 hover:text-white p-4 rounded-2xl border border-slate-100 transition-all shadow-sm disabled:opacity-50"
                        >
                          {isDrafting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {editingStep === step.id && (
                      <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-slideDown">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Compte-rendu d'exécution (PV de constatations)</label>
                        <textarea 
                          className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#002654] outline-none transition-all resize-none text-sm font-medium bg-white shadow-inner"
                          placeholder="Décrivez précisément les résultats obtenus..."
                          rows={4}
                          value={stepResult}
                          onChange={(e) => setStepResult(e.target.value)}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                          <button onClick={() => setEditingStep(null)} className="px-6 py-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">Annuler</button>
                          <button 
                            onClick={() => markStepComplete(step.id, stepResult)}
                            disabled={!stepResult.trim()}
                            className="bg-[#002654] text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-900 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                          >
                            Valider l'acte
                          </button>
                        </div>
                      </div>
                    )}

                    {step.completed && step.result && (
                      <div className="mt-6 p-6 bg-white border border-emerald-100 rounded-2xl shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-5 text-emerald-900"><CheckCircle2 className="w-12 h-12" /></div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                           Rapport validé le {new Date().toLocaleDateString()}
                        </p>
                        <p className="text-slate-700 text-sm italic font-medium leading-relaxed">"{step.result}"</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal: PV Draft */}
      {currentDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#002654]/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-3 rounded-2xl text-amber-700 shadow-sm">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-[#002654] uppercase text-xs tracking-[0.2em]">Brouillon Officiel OPJ</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{currentDraft.title}</p>
                </div>
              </div>
              <button onClick={() => setCurrentDraft(null)} className="text-slate-400 hover:text-slate-600 p-2 bg-white rounded-full border border-slate-100 transition-all shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 font-serif text-base leading-loose text-slate-800 bg-slate-100/30">
              <div className="bg-white p-12 shadow-2xl border border-slate-200 whitespace-pre-wrap rounded-2xl min-h-[500px] max-w-3xl mx-auto shadow-slate-200/50">
                {currentDraft.content}
              </div>
            </div>
            <div className="p-8 bg-white border-t border-slate-200 flex justify-end gap-4">
              <button onClick={() => setCurrentDraft(null)} className="px-8 py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest">Fermer</button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(currentDraft.content);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center gap-3 transition-all shadow-2xl ${
                  copied ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-[#002654] hover:bg-blue-900 text-white shadow-blue-200'
                }`}
              >
                {copied ? <><Check className="w-4 h-4" /> Copié</> : <><Copy className="w-4 h-4" /> Copier PV</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-6xl mx-auto px-4 text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-1 px-1 bg-blue-900 rounded-full"></div>
            <p className="text-[11px] text-[#002654] font-black uppercase tracking-[0.3em]">Gendarmerie Nationale</p>
            <div className="w-12 h-1 px-1 bg-blue-900 rounded-full"></div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium italic max-w-2xl mx-auto">
            Cet outil est une aide à la décision. Les données saisies sont stockées localement (WebStorage API). 
            La transmission à l'IA Gemini est protégée par anonymisation automatique.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slideDown { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        body { background-color: #f8fafc; color: #0f172a; -webkit-font-smoothing: antialiased; }
        * { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
      `}</style>
    </div>
  );
};

export default App;
