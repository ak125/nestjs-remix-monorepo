/**
 * MCP SHARED TYPES
 * Généré selon standards enterprise MCP
 * Types partagés backend/frontend pour module Welcome
 */

export interface SessionData {
  log: string;
  mykey: string;
}

export interface AuthResult {
  destinationLink: string;
  ssid: number;
  accessRequest: boolean;
  destinationLinkMsg: 'Expired' | 'Denied' | 'Granted' | 'Suspended';
  destinationLinkGranted: 0 | 1;
}

export interface WelcomePageData {
  title: string;
  message: string;
  userInfo?: AuthResult;
  domainName: string;
}

export interface DatabaseUser {
  CNFA_ID: number;
  CNFA_LOGIN: string;
  CNFA_KEYLOG: string;
  CNFA_ACTIV: '0' | '1';
}
