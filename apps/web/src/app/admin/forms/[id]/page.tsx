export default async function EditFormPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar formulario</h1>
      <p className="text-gray-500 text-sm">ID: {params.id}</p>
    </div>
  );
}
