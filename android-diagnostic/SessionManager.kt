package com.bookorbit.core.auth

import com.bookorbit.core.model.AuthUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/** Top-level auth state used to gate navigation (server-setup -> login -> main). */
sealed interface SessionState {
    data object Loading : SessionState
    data object NeedsServer : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val user: AuthUser) : SessionState
}

@Singleton
class SessionManager @Inject constructor(
    private val storage: SecureStorage,
    private val json: Json,
) {
    @Volatile
    var accessToken: String? = null
        private set

    @Volatile
    var serverUrl: String? = null
        private set

    private val _state = MutableStateFlow<SessionState>(SessionState.Loading)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    val currentUser: AuthUser? get() = (_state.value as? SessionState.SignedIn)?.user

    fun bootstrap() {
        serverUrl = storage.getString(SecureStorage.KEY_SERVER_URL)
        accessToken = storage.getString(SecureStorage.KEY_ACCESS_TOKEN)
        val user = storage.getString(SecureStorage.KEY_USER)
            ?.let { runCatching { json.decodeFromString<AuthUser>(it) }.getOrNull() }

        _state.value = when {
            serverUrl.isNullOrBlank() -> SessionState.NeedsServer
            accessToken.isNullOrBlank() || user == null -> SessionState.SignedOut
            else -> SessionState.SignedIn(user)
        }
    }

    /**
     * Temporarily points OkHttp at a candidate server without persisting it or changing
     * SessionState. This prevents the onboarding UI jumping to Login before the probe succeeds.
     * Returns the prior in-memory URL so a failed probe can restore it.
     */
    fun setServerUrlForProbe(url: String): String? {
        val previous = serverUrl
        serverUrl = url.trimEnd('/')
        return previous
    }

    fun restoreServerUrlAfterProbe(previousUrl: String?) {
        serverUrl = previousUrl
    }

    fun setServerUrl(url: String) {
        serverUrl = url.trimEnd('/')
        storage.putString(SecureStorage.KEY_SERVER_URL, serverUrl)
        if (_state.value is SessionState.Loading || _state.value is SessionState.NeedsServer) {
            _state.value = SessionState.SignedOut
        }
    }

    fun clearServer() {
        serverUrl = null
        storage.remove(SecureStorage.KEY_SERVER_URL)
        _state.value = SessionState.NeedsServer
    }

    fun signIn(token: String, user: AuthUser) {
        accessToken = token
        storage.putString(SecureStorage.KEY_ACCESS_TOKEN, token)
        storage.putString(SecureStorage.KEY_USER, json.encodeToString(AuthUser.serializer(), user))
        _state.value = SessionState.SignedIn(user)
    }

    fun updateAccessToken(token: String) {
        accessToken = token
        storage.putString(SecureStorage.KEY_ACCESS_TOKEN, token)
    }

    fun signOut() {
        accessToken = null
        storage.remove(SecureStorage.KEY_ACCESS_TOKEN)
        storage.remove(SecureStorage.KEY_USER)
        storage.remove(SecureStorage.KEY_COOKIES)
        if (serverUrl.isNullOrBlank()) {
            _state.value = SessionState.NeedsServer
        } else {
            _state.value = SessionState.SignedOut
        }
    }
}
