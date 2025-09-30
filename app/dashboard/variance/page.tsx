import VarianceAnalyzerEnhanced from '@/components/variance-analyzer-enhanced';

export default function VariancePage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <VarianceAnalyzerEnhanced
        autoLoad={true}
        enableN8nSync={true}
        onAnalysisComplete={(analysis) => {
          console.log('Analysis completed:', analysis.name);
        }}
      />
    </div>
  );
}