import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();

    try {
      const canBeActivated = (await super.canActivate(context)) as boolean;

      // Ne faire logIn que si l'authentification a réussi
      if (canBeActivated && request.user) {
        await super.logIn(request);
      }

      return canBeActivated;
    } catch (error: any) {
      throw error;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();

      // Cas spécial : Missing credentials = utilisateur non connecté
      if (info?.message === 'Missing credentials') {
        response.status(401).json({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentification requise',
          errorType: 'authentication_required',
          details: 'Vous devez être connecté pour accéder à cette ressource.',
        });
        return false;
      }

      // Déterminer le type d'erreur avec des messages plus clairs
      let errorType = 'invalid_credentials';
      let errorMessage =
        "L'email ou le mot de passe que vous avez saisi est incorrect.";
      let errorDetails = 'Veuillez vérifier vos identifiants et réessayer.';

      // Vérifier si c'est une erreur de rate limiting
      if (err?.message?.includes('Trop de tentatives')) {
        errorType = 'rate_limited';
        errorMessage = 'Trop de tentatives de connexion détectées.';
        errorDetails =
          'Votre compte est temporairement bloqué. Veuillez réessayer dans quelques minutes.';
      }

      // Vérifier si c'est un problème d'utilisateur inactif
      if (
        err?.message?.includes('inactif') ||
        err?.message?.includes('désactivé')
      ) {
        errorType = 'account_disabled';
        errorMessage = 'Votre compte est désactivé.';
        errorDetails =
          "Veuillez contacter l'administrateur pour réactiver votre compte.";
      }

      // Vérifier si c'est un problème d'email non trouvé
      if (
        err?.message?.includes('email') &&
        err?.message?.includes('invalide')
      ) {
        errorType = 'email_not_found';
        errorMessage = 'Aucun compte associé à cette adresse email.';
        errorDetails =
          "Vérifiez l'orthographe de votre email ou créez un nouveau compte.";
      }

      // Si c'est une requête API (Accept: application/json)
      const acceptHeader = request.headers.accept || '';
      if (acceptHeader.includes('application/json')) {
        return response.status(401).json({
          success: false,
          error: {
            type: errorType,
            message: errorMessage,
            details: errorDetails,
            code: 'AUTH_FAILED',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
          suggestions: this.getErrorSuggestions(errorType),
        });
      }

      // Si c'est une requête web, rediriger vers login avec erreur
      const email = request.body?.email || '';
      return response.redirect(
        `/auth/login?error=${errorType}&message=${encodeURIComponent(errorMessage)}&email=${encodeURIComponent(email)}`,
      );
    }

    return user;
  }

  private getErrorSuggestions(errorType: string): string[] {
    switch (errorType) {
      case 'invalid_credentials':
        return [
          'Vérifiez que votre email est correctement saisi',
          'Assurez-vous que votre mot de passe est correct',
          "Vérifiez que la touche Caps Lock n'est pas activée",
        ];
      case 'rate_limited':
        return [
          'Attendez quelques minutes avant de réessayer',
          'Vérifiez vos identifiants pour éviter de nouveaux échecs',
          'Contactez le support si le problème persiste',
        ];
      case 'account_disabled':
        return [
          "Contactez l'administrateur du site",
          "Vérifiez vos emails pour d'éventuelles notifications",
          "Assurez-vous que votre compte n'a pas expiré",
        ];
      case 'email_not_found':
        return [
          "Vérifiez l'orthographe de votre adresse email",
          'Essayez avec une autre adresse email',
          'Créez un nouveau compte si nécessaire',
        ];
      default:
        return ['Contactez le support technique si le problème persiste'];
    }
  }
}
