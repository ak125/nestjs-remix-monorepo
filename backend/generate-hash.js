const { hash, compare } = require('bcryptjs');

(async () => {
  const plainPassword = '123';
  const hashedPassword = await hash(plainPassword, 10);
  console.log('Nouveau mot de passe haché :', hashedPassword);

  const isValid = await compare(plainPassword, hashedPassword);
  console.log('Comparaison avec le nouveau hachage :', isValid);
})();
