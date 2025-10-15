export function Team() {
  const team = [
    { name: 'Jean Dupont', role: 'CEO', quote: 'Excellence en toute chose' },
    { name: 'Marie Martin', role: 'Directrice Technique', quote: 'Innovation et qualité' },
    { name: 'Pierre Bernard', role: 'Service Client', quote: 'Votre satisfaction d\'abord' },
  ];
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">Notre Équipe</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {team.map((member, index) => (
            <div key={index} className="text-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 mx-auto mb-4"></div>
              <h3 className="text-xl font-bold">{member.name}</h3>
              <p className="text-gray-600">{member.role}</p>
              <p className="italic text-gray-500 mt-2">"{member.quote}"</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
