import { writable } from 'svelte/store';

interface MetaMaskState {
	isInstalled: boolean;
	isConnected: boolean;
	address: string | null;
	error: string | null;
}

const createMetaMaskStore = () => {
	const { subscribe, set, update } = writable<MetaMaskState>({
		isInstalled: false,
		isConnected: false,
		address: null,
		error: null
	});

	// Check if MetaMask is installed
	const checkInstallation = () => {
		if (typeof window !== 'undefined' && window.ethereum?.isMetaMask) {
			update(state => ({ ...state, isInstalled: true }));
			return true;
		}
		update(state => ({ ...state, isInstalled: false }));
		return false;
	};

	// Connect to MetaMask
	const connect = async () => {
		if (!checkInstallation() || !window.ethereum) {
			update(state => ({
				...state,
				error: 'MetaMask is not installed. Please install MetaMask extension.'
			}));
			return false;
		}

		try {
			// Request account access
			const accounts = await window.ethereum.request({
				method: 'eth_requestAccounts'
			});

			if (accounts && accounts.length > 0) {
				const address = accounts[0];
				update(state => ({
					...state,
					isConnected: true,
					address,
					error: null
				}));
				return true;
			}
			return false;
		} catch (error: any) {
			const errorMessage = error?.message || 'Failed to connect to MetaMask';
			update(state => ({
				...state,
				error: errorMessage,
				isConnected: false,
				address: null
			}));
			return false;
		}
	};

	// Disconnect
	const disconnect = () => {
		set({
			isInstalled: false,
			isConnected: false,
			address: null,
			error: null
		});
	};

	// Check connection status
	const checkConnection = async () => {
		if (!checkInstallation() || !window.ethereum) {
			return false;
		}

		try {
			const accounts = await window.ethereum.request({
				method: 'eth_accounts'
			});

			if (accounts && accounts.length > 0) {
				update(state => ({
					...state,
					isConnected: true,
					address: accounts[0],
					error: null
				}));
				return true;
			} else {
				update(state => ({
					...state,
					isConnected: false,
					address: null
				}));
				return false;
			}
		} catch (error) {
			return false;
		}
	};

	// Initialize on load
	if (typeof window !== 'undefined') {
		checkInstallation();
		checkConnection();

		// Listen for account changes
		window.ethereum?.on('accountsChanged', (accounts: string[]) => {
			if (accounts && accounts.length > 0) {
				update(state => ({
					...state,
					isConnected: true,
					address: accounts[0],
					error: null
				}));
			} else {
				disconnect();
			}
		});

		// Listen for chain changes
		window.ethereum?.on('chainChanged', () => {
			// Reload page on chain change
			window.location.reload();
		});
	}

	return {
		subscribe,
		connect,
		disconnect,
		checkConnection,
		checkInstallation
	};
};

export const metamask = createMetaMaskStore();

// Helper function to format address
export function formatAddress(address: string | null): string {
	if (!address) return '';
	if (address.length < 10) return address;
	return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

