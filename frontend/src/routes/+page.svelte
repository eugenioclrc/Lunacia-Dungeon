<script lang="ts">
    import Game from '$lib/components/Game.svelte';
	import { metamask, formatAddress } from '$lib/stores/metamask.ts';
    import { onMount } from 'svelte';
	import { WebSocketService, type WsStatus } from '$lib/websocket';
	import { createWalletClient, custom, type WalletClient, getAddress } from 'viem';
	import { mainnet, sepolia } from 'viem/chains';


	// CHAPTER 3: Authentication imports
import {
    createAuthRequestMessage,
    createAuthVerifyMessage,
    createEIP712AuthMessageSigner,
    parseAnyRPCResponse,
    RPCMethod,
    type AuthChallengeResponse,
    type AuthRequestParams,
} from '@erc7824/nitrolite';
// CHAPTER 3: Authentication utilities
import {
    generateSessionKey,
    getStoredSessionKey,
    storeSessionKey,
    removeSessionKey,
    storeJWT,
    removeJWT,
    type SessionKey,
} from '$lib/sessionutils';

// CHAPTER 3: EIP-712 domain for authentication
const getAuthDomain = () => ({
    name: 'EnterTheDungeon',
});

// CHAPTER 3: Authentication constants
const AUTH_SCOPE = 'all';
const APP_NAME = 'EnterTheDungeon';
const SESSION_DURATION = "1763865200"; // 1 hour

let isAuthenticated = false;
let tempClient: WalletClient | null = null;
let tempAddress: string | null = null;

    let eoaAddress = '';
	let isConnecting = false;
    let onlineUsers = 0;
	let isConnected = false;

	// Auto-fill address when MetaMask connects
	$: if ($metamask.isConnected && $metamask.address) {
		eoaAddress = $metamask.address;
	}

	let webSocketService;
	let sessionKey: SessionKey | null = null;
	$: if (eoaAddress && isConnected) {
		webSocketService = new WebSocketService();
		webSocketService.addMessageListener((message) => {
			console.log('message', message);
		});

	const handleMessage = async (data: any) => {
        const response = parseAnyRPCResponse(JSON.stringify(data));

        // Handle auth challenge
        if (
            response.method === RPCMethod.AuthChallenge &&
            sessionKey &&
            eoaAddress &&
            SESSION_DURATION
        ) {
            const challengeResponse = response as AuthChallengeResponse;


            const authParams = {
                scope: AUTH_SCOPE,
                application: getAddress(eoaAddress) as `0x${string}`,
                participant: getAddress(sessionKey.address) as `0x${string}`,
                expire: SESSION_DURATION,
                allowances: []
            };

            const eip712Signer = createEIP712AuthMessageSigner(tempClient, authParams, getAuthDomain());

            try {
                const authVerifyPayload = await createAuthVerifyMessage(eip712Signer, challengeResponse);
                webSocketService.send(authVerifyPayload);
            } catch (error) {
                alert('Signature rejected. Please try again.');
            }
        }

		//isAuthenticated = true;
        // Handle auth success
        if (response.method === RPCMethod.AuthVerify && response.params?.success) {
            isAuthenticated = true;
            if (response.params.jwtToken) storeJWT(response.params.jwtToken);
        }
        // Handle errors
        if (response.method === RPCMethod.Error) {
            removeJWT();
            // Clear session key on auth failure to regenerate next time
            removeSessionKey();
            alert(`Authentication failed: ${response.params.error}`);
            isAuthenticated = false;
        }
    };

    webSocketService.addMessageListener(handleMessage);


		webSocketService.connect('wss://clearnet.yellow.com/ws');
		
		
		// CHAPTER 3: Get or generate session key on startup (IMPORTANT: Store in localStorage)
		const existingSessionKey = getStoredSessionKey();
		if (existingSessionKey) {
			sessionKey = existingSessionKey;
		} else {
			const newSessionKey = generateSessionKey();
			storeSessionKey(newSessionKey);
			sessionKey = newSessionKey;
		}

		const authParams: AuthRequestParams = {
            address: getAddress(eoaAddress),
            session_key: getAddress(sessionKey.address),
            app_name: APP_NAME,
            expire: SESSION_DURATION,
            scope: AUTH_SCOPE,
            application: getAddress(eoaAddress),
            allowances: [],
        };

		createAuthRequestMessage(authParams).then((payload) => {
            if (webSocketService) {
                webSocketService.send(payload);
            }
        });
	}


    onMount(async () => {

    });

    async function handleConnectMetaMask(e: Event) {
		e.preventDefault();

		isConnecting = true;
		try {

			//await metamask.connect();

			// First get the address
			tempClient = createWalletClient({
				account: eoaAddress as `0x${string}`,
				transport: custom((window as any).ethereum),
			});
			window.client = tempClient;
			//const addresses = await tempClient.requestAddresses();
			tempAddress = eoaAddress;

			isConnected = true;
		} catch (error) {
			console.error('Failed to connect MetaMask:', error);
		} finally {
			isConnecting = false;
		}
	}

    async function handleCreateRoom() {
        
        console.log('Creating room');
    }

    async function handleDisconnectMetaMask() {
        await metamask.disconnect();
    }

</script>

<main class="flex flex-col items-center text-white min-h-screen font-mono mb-10">
    <h1 class="my-5 mt-5 mb-2.5">SvelteKit Roguelike</h1>
    <p class="mb-5">Use arrow keys to move. Bump into enemies to attack.</p>


	{#if !isAuthenticated}
<div class="bg-white rounded-lg shadow-lg p-6 text-black">

	<div class="mb-4">
		<label for="eoa" class="block text-sm font-medium mb-2">Ethereum Address</label>
		<div class="flex gap-2">
			<input
				id="eoa"
				type="text"
				bind:value={eoaAddress}
				placeholder="0x..."
				class="flex-1 px-3 py-2 border border-gray-300 rounded-md"
				readonly={$metamask.isConnected}
			/>
			{#if $metamask.isConnected && tempAddress}
				<button
					on:click={() => metamask.disconnect()}
					class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 whitespace-nowrap"
				>
					Disconnect
				</button>
			{:else}
				<button
					on:click|preventDefault={handleConnectMetaMask}
					disabled={isConnecting || !$metamask.isInstalled}
					class="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
				>
					{isConnecting ? 'Connecting...' : 'Connect MetaMask'}
				</button>
			{/if}
		</div>
		{#if $metamask.isConnected && $metamask.address}
			<p class="text-sm text-green-600 mt-1">
				Connected: {formatAddress($metamask.address)}
			</p>
		{:else if $metamask.error}
			<p class="text-sm text-red-600 mt-1">
				{$metamask.error}
			</p>
		{:else if !$metamask.isInstalled}
			<p class="text-sm text-gray-500 mt-1">
				MetaMask not detected. <a href="https://metamask.io/" target="_blank" class="text-blue-500 underline">Install MetaMask</a>
			</p>
		{/if}
	</div>


	<div class="text-center text-sm text-gray-600">
		Online: {onlineUsers} player{onlineUsers !== 1 ? 's' : ''}
	</div>
</div>
{/if}

{#if $metamask.isConnected && isAuthenticated}
    <Game />
{/if}
</main>
