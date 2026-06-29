export default function QuestionsPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Preguntas del formulario</h1>
      <p className="text-gray-500 text-sm">Form ID: {params.id}</p>
    </div>
  );
}
