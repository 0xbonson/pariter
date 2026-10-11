/**
 * Formats low-level Web3 and Wagmi error messages into clear, user-friendly notices.
 * Sanitizes internal stack traces and raw library version identifiers (e.g. "@wagmi/core...").
 */
export function formatWalletErrorMessage(err: unknown): string {
  if (!err) return 'An unexpected error occurred.';
  const msg = typeof err === 'string' ? err : (err as Error).message || '';

  // Injected Provider not found (missing wallet extension)
  if (
    msg.includes('Provider not found') ||
    msg.includes('provider not found') ||
    msg.includes('Connector not found') ||
    msg.includes('No provider') ||
    msg.includes('window.ethereum')
  ) {
    return 'No Web3 browser wallet detected. Please install MetaMask, Rabby, or an Arc-compatible browser extension.';
  }

  // User cancelled or rejected request in wallet popup
  if (
    msg.includes('User rejected') ||
    msg.includes('user rejected') ||
    msg.includes('User denied') ||
    msg.includes('UserRejectedRequestError') ||
    msg.includes('ACTION_REJECTED')
  ) {
    return 'Transaction request was cancelled by the user in the wallet.';
  }

  // Balance insufficient
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
    return 'Insufficient USDC funds for transfer amount or native gas fees.';
  }

  // Network transport / RPC issues
  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection refused')
  ) {
    return 'Network connection to Arc RPC timed out or was interrupted. Please check network connectivity.';
  }

  // Strip raw Wagmi metadata lines such as "Version: @wagmi/core@2.x..."
  const cleanMsg = msg
    .split('\n')
    .filter((line) => !line.trim().startsWith('Version:') && !line.trim().startsWith('Details:'))
    .join(' ')
    .trim();

  return cleanMsg.length > 200 ? `${cleanMsg.slice(0, 200)}...` : cleanMsg || 'Wallet operation failed.';
}
