import {
  WalletAccount,
  Wallet,
  getWallets,
  isWalletInstalled,
} from '@talisman-connect/wallets';
import {
  ButtonHTMLAttributes,
  cloneElement,
  ReactElement,
  ReactHTMLElement,
  ReactPropTypes,
  useEffect,
  useState,
} from 'react';
import Modal from '../../lib/Modal/Modal';
import { ReactComponent as ChevronRightIcon } from '../../assets/icons/chevron-right.svg';
import styles from './WalletSelect.module.css';
import { truncateMiddle } from '../../utils/truncateMiddle';

export interface WalletSelectProps {
  onWalletConnectOpen?: (wallets: Wallet[]) => unknown;
  onWalletConnectClose?: () => unknown;
  onWalletSelected?: (wallet: Wallet) => unknown;
  onUpdatedAccounts?: (accounts: WalletAccount[] | undefined) => unknown;
  onAccountSelected?: (account: WalletAccount) => unknown;
  triggerComponent?: ReactElement;

  // If `showAccountsList` is specified, then account selection modal will show up.
  showAccountsList?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NoWalletLink(props: any) {
  return (
    <button
      style={{
        textAlign: 'center',
        textDecoration: 'underline',
        width: '100%',
        fontSize: 'small',
        opacity: 0.5,
      }}
      onClick={props.onClick}
    >
      I don't have a wallet
    </button>
  );
}

type ListWithClickProps<T> =
  | {
      items?: T[];
      onClick: (item: T) => unknown;
      skeleton?: false;
    }
  | { skeleton: true; items?: never; onClick?: never };

function WalletList(props: ListWithClickProps<Wallet>) {
  const { items, onClick } = props;
  if (!items) {
    return null;
  }
  return (
    <>
      {items.map((wallet) => {
        return (
          <button
            key={wallet.extensionName}
            className={styles['row-button']}
            onClick={() => onClick?.(wallet)}
          >
            <span className={styles['flex']}>
              <img
                src={wallet.logo.src}
                alt={wallet.logo.alt}
                width={32}
                height={32}
              />
              {!wallet.installed && 'Try '}
              {wallet.title}
            </span>
            <ChevronRightIcon />
          </button>
        );
      })}
    </>
  );
}

function AccountList(props: ListWithClickProps<WalletAccount>) {
  const { items, onClick, skeleton = false } = props;
  if (!items && !skeleton) {
    return null;
  }
  const listItems = skeleton
    ? Array.from(
        { length: 2 },
        (v, i): WalletAccount => ({
          name: 'dummy',
          source: `${i}`,
          address: 'dummy',
        })
      )
    : items;
  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <>
      {listItems?.map((account) => {
        return (
          <button
            key={`${account.source}-${account.address}`}
            className={styles['row-button']}
            onClick={() => onClick?.(account)}
          >
            <span
              style={{ textAlign: 'left', opacity: skeleton ? 0 : 'unset' }}
            >
              <div>{account.name}</div>
              <div style={{ fontSize: 'small', opacity: 0.5 }}>
                {truncateMiddle(account.address)}
              </div>
            </span>
            {!skeleton && <ChevronRightIcon />}
          </button>
        );
      })}
    </>
  );
}

export function WalletSelect(props: WalletSelectProps) {
  const {
    onWalletConnectOpen,
    onWalletConnectClose,
    onWalletSelected,
    onUpdatedAccounts,
    onAccountSelected,
    triggerComponent,
    showAccountsList,
  } = props;

  const [supportedWallets, setWallets] = useState<Wallet[]>();
  const [selectedWallet, setSelectedWallet] = useState<Wallet>();
  const [accounts, setAccounts] = useState<WalletAccount[] | undefined>();
  const [loadingAccounts, setLoadingAccounts] = useState<boolean | undefined>();
  const [unsubscribe, setUnsubscribe] = useState<() => unknown>();

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check saved `@talisman-connect/selected-wallet-name`
    // to see if the it is still installed or not.
    const selectedName = localStorage.getItem(
      '@talisman-connect/selected-wallet-name'
    );
    if (!isWalletInstalled(selectedName)) {
      localStorage.removeItem('@talisman-connect/selected-wallet-name');
    }
    return () => {
      // TODO: Proper Cleanup
      if (unsubscribe) {
        unsubscribe();
      }
    };
  });

  const onModalClose = () => {
    setIsOpen(false);
    if (onWalletConnectClose) {
      onWalletConnectClose();
    }
  };

  const onWalletListSelected = async (wallet: Wallet) => {
    setLoadingAccounts(true);
    setSelectedWallet(wallet);
    if (onWalletSelected) {
      onWalletSelected(wallet);
    }

    localStorage.setItem(
      '@talisman-connect/selected-wallet-name',
      wallet.extensionName
    );

    const walletSelectedEvent = new CustomEvent(
      '@talisman-connect/wallet-selected',
      {
        detail: wallet,
      }
    );
    document.dispatchEvent(walletSelectedEvent);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsub: any = await wallet.subscribeAccounts((accounts) => {
      setLoadingAccounts(false);
      setAccounts(accounts);
      if (onUpdatedAccounts) {
        onUpdatedAccounts(accounts);
      }
    });

    setUnsubscribe(unsub);

    if (!showAccountsList && wallet.installed) {
      setSelectedWallet(undefined);
      setIsOpen(false);
    }
  };

  const accountsSelectionTitle = selectedWallet?.installed
    ? `Select ${selectedWallet?.title} account`
    : loadingAccounts
    ? `Loading...`
    : `Haven't got a wallet yet?`;

  const title = !selectedWallet ? 'Connect wallet' : accountsSelectionTitle;

  const selectedWalletAccounts = accounts?.filter(
    (account) => account.source === selectedWallet?.extensionName
  );

  const hasLoaded = loadingAccounts === false;
  const hasAccounts =
    hasLoaded &&
    selectedWallet?.installed &&
    selectedWalletAccounts &&
    selectedWalletAccounts?.length > 0;

  return (
    <>
      {triggerComponent &&
        cloneElement(triggerComponent, {
          onClick: (e: Event) => {
            e.stopPropagation();
            const wallets = getWallets();
            setWallets(wallets);
            setIsOpen(true);
            if (onWalletConnectOpen) {
              onWalletConnectOpen(wallets);
            }
            triggerComponent.props.onClick?.(wallets);
          },
        })}
      <Modal
        className={styles['modal-overrides']}
        title={title}
        footer={
          !selectedWallet && (
            <NoWalletLink
              onClick={async () => {
                // TODO: Figure out this flow. Blindly pointing to Talisman does not work.
                // First one is top priority
                await onWalletListSelected(supportedWallets?.[0] as Wallet);
              }}
            />
          )
        }
        handleClose={onModalClose}
        handleBack={
          selectedWallet ? () => setSelectedWallet(undefined) : undefined
        }
        isOpen={isOpen}
      >
        {!selectedWallet && (
          <WalletList items={supportedWallets} onClick={onWalletListSelected} />
        )}
        {selectedWallet && showAccountsList && loadingAccounts && (
          <AccountList skeleton />
        )}
        {selectedWallet &&
          !selectedWallet?.installed &&
          loadingAccounts === false && (
            <>
              <div className={styles['no-extension-message']}>
                {selectedWallet?.noExtensionMessage}
              </div>
              <a
                className={styles['row-button']}
                href={selectedWallet?.installUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <button className={styles['row-button']}>
                  <span className={styles['flex']}>
                    <img
                      src={selectedWallet?.logo.src}
                      alt={selectedWallet?.logo.alt}
                      width={32}
                      height={32}
                    />
                    Install {selectedWallet?.title}
                  </span>
                  <ChevronRightIcon />
                </button>
              </a>
            </>
          )}
        {selectedWallet &&
          selectedWallet?.installed &&
          showAccountsList &&
          loadingAccounts === false && (
            <>
              {!hasAccounts && (
                <div className={styles['no-extension-message']}>
                  <div>No accounts found.</div>
                  <div>
                    Add an account in {selectedWallet?.title} to get started.
                  </div>
                </div>
              )}
              {hasAccounts && (
                <AccountList
                  items={selectedWalletAccounts}
                  onClick={(account) => {
                    if (onAccountSelected) {
                      onAccountSelected(account);
                    }
                    onModalClose();
                  }}
                />
              )}
            </>
          )}
      </Modal>
    </>
  );
}

export default WalletSelect;
