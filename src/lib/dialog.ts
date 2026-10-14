// The app's own alert dialog — themed, identical on iOS and Android.
// `showAlert` takes the same arguments as React Native's `Alert.alert`, so any
// call site can switch by changing the function name. A single <DialogHost/>
// (root layout) renders whatever is requested here, one dialog at a time.

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
    text: string;
    style?: DialogButtonStyle;
    onPress?: () => void;
}

export interface DialogOptions {
    /** Tapping outside / Android back closes it (as Cancel). Default true. */
    cancelable?: boolean;
    onDismiss?: () => void;
}

export interface DialogRequest {
    id: number;
    title: string;
    message?: string;
    buttons: DialogButton[];
    options: DialogOptions;
}

type Listener = (request: DialogRequest) => void;

let listener: Listener | null = null;
let nextId = 1;
const pending: DialogRequest[] = []; // asked for before the host mounted

/** DialogHost subscribes here; returns an unsubscribe. */
export const subscribeToDialogs = (onRequest: Listener) => {
    listener = onRequest;
    pending.splice(0).forEach(onRequest);
    return () => {
        if (listener === onRequest) listener = null;
    };
};

export const showAlert = (title: string, message?: string, buttons?: DialogButton[], options: DialogOptions = {}) => {
    const request: DialogRequest = {
        id: nextId++,
        title,
        message,
        buttons: buttons?.length ? buttons : [{ text: 'OK' }],
        options,
    };
    if (listener) listener(request);
    else pending.push(request);
};
