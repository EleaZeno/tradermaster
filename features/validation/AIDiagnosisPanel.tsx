
import React, { useState } from 'react';
import { useGameStore } from '../../shared/store/useGameStore';
import { Card, Button } from '../../shared/components';
import { Bot, RefreshCw, AlertTriangle, CheckCircle2, ClipboardCheck, Activity } from 'lucide-react';
import { HealthCheckService } from '../../domain/analytics/HealthCheckService';
import { auditEconomy } from '../../infrastructure/ai/GeminiAdapter';
import DOMPurify from 'dompurify';

// @ts-ignore
const marked = window.marked;

export const AIDiagnosisPanel: React.FC = () => {
  const gameState = useGameStore(s => s.gameState);
  const [report, setReport] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [lastAuditDay, setLastAuditDay] = useState<number | null>(null);

  const runDiagnosis = async () => {
      setLoading(true);
      const snapshot = HealthCheckService.captureSnapshot(gameState);
      try {
          const result = await auditEconomy(snapshot);
          setReport(result);
          setLastAuditDay(gameState.day);
      } catch (e) {
          setReport("Audit Failed: Unable to contact AI services.");
      } finally {
          setLoading(false);
      }
  };

  const renderContent = (text: string) => {
      if (!text) return null;
      if (!marked) return <pre className="whitespace-pre-wrap">{text}</pre>;
      const rawHtml = marked.parse(text);
      return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml as string) }} />;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[500px]">
        <div className="lg:col-span-4 space-y-4">
            <Card className="bg-stone-900 border-stone-800">
                <div className="flex flex-col items-center text-center p-4">
                    <div className="p-4 bg-indigo-900/30 rounded-full border border-indigo-500/50 mb-4 shadow-lg shadow-indigo-900/20">
                        <Bot size={48} className={loading ? "text-indigo-400 animate-pulse" : "text-indigo-400"} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">AI 经济审计官</h3>
                    <p className="text-sm text-stone-400 mb-6">
                        利用 Gemini AI 对当前经济体的<br/>
                        宏观指标、市场微观结构和逻辑一致性<br/>
                        进行全方位体检。
                    </p>
                    
                    <Button 
                        onClick={runDiagnosis} 
                        disabled={loading}
                        className="w-full py-3 text-lg shadow-xl shadow-indigo-900/20"
                        variant="primary"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2"><RefreshCw className="animate-spin" size={18}/> 正在诊断中...</span>
                        ) : (
                            <span className="flex items-center gap-2"><ClipboardCheck size={18}/> 开始全面审计</span>
                        )}
                    </Button>
                    
                    {lastAuditDay && (
                        <div className="mt-4 text-xs text-stone-600 font-mono">
                            上次审计: Day {lastAuditDay}
                        </div>
                    )}
                </div>
            </Card>

            <div className="bg-stone-950 rounded-xl p-4 border border-stone-800">
                <h4 className="text-xs font-bold text-stone-500 uppercase mb-3">监控指标预览</h4>
                <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                        <span className="text-stone-400">GDP Flows</span>
                        <span className="text-emerald-500">Active</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-stone-400">Market Depth</span>
                        <span className="text-emerald-500">LOB Ready</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-stone-400">Phillips Curve</span>
                        <span className="text-emerald-500">Tracking</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-stone-400">Wage-Price Spiral</span>
                        <span className="text-amber-500">Monitoring</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-8">
            <Card className="h-full bg-stone-900 border-stone-800 min-h-[500px] flex flex-col relative overflow-hidden">
                {!report && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center text-stone-600 flex-col gap-2 opacity-50">
                        <Activity size={64} strokeWidth={1} />
                        <span className="text-sm">等待启动诊断程序...</span>
                    </div>
                )}
                
                {report && (
                    <div className="prose prose-invert prose-sm max-w-none h-full overflow-y-auto custom-scrollbar p-2">
                        {renderContent(report)}
                    </div>
                )}
            </Card>
        </div>
    </div>
  );
};
