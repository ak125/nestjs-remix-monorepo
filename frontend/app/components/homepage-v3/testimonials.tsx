interface Testimonial {
  id: number;
  name: string;
  location: string;
  rating: number;
  comment: string;
}

interface TestimonialsProps {
  testimonials: Testimonial[];
}

export function Testimonials({ testimonials }: TestimonialsProps) {
  return (
    <section className="py-20 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">Ce que disent nos clients</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-white/10 backdrop-blur-md p-8 rounded-2xl">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={i < testimonial.rating ? 'text-yellow-400' : 'text-gray-400'}>⭐</span>
                ))}
              </div>
              <p className="italic mb-4">"{testimonial.comment}"</p>
              <footer className="font-semibold">— {testimonial.name}, {testimonial.location}</footer>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
