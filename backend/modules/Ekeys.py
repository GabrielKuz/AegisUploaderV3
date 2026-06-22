import os

keys = []
ivs = []


def createEncryptKey():
    key = os.urandom(32)  # 256-bit key
    iv = os.urandom(16)   # 128-bit IV
    keys.append(key)
    ivs.append(iv)
    return key, iv

