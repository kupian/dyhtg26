class GameError(Exception):
    pass

class RoomError(GameError):
    pass

class PlayerError(GameError):
    pass

class EncodingError(GameError):
    pass