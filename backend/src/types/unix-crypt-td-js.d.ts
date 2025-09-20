declare module 'unix-crypt-td-js' {
  function crypt(password: string, salt: string): string;
  export = crypt;
}
