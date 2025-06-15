print("Loading libraries...")

library(tidyverse)
library(dplyr)

rm(list = ls())

mpg %>% 
    filter(class == "compact") %>%
    ggplot(mapping = aes(x = displ, y = hwy)) +
    geom_point()

ggplot(data = mpg) + 
    geom_point(mapping = aes(x = displ, y = hwy))
